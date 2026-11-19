import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { inspectAttachment } from './attachments.mjs';
import {
  HTML_TAG_SET,
  REVIEW_NOTE,
  UNSUPPORTED,
  assertSafeGit,
  classifyUrl,
  inside,
  isCalendarDate,
  lineOf,
  loadConventions,
  maskInactive,
  planGit,
  readDeployContract,
  shanghaiDate,
  slugifyTag,
  yamlQuote,
} from './conventions.mjs';

const BODY_LIMIT = 200_000;
const HTML_LIMIT = 100_000;
const IMAGE_LIMIT = 8_000_000;
const IMAGE_SRC = /^\/images(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)+$/;
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(['en', 'index', 'posts', 'tags', 'categories', 'rss']);
const META_KEYS = new Set(['slug', 'title', 'description', 'pubDate', 'updatedDate', 'tags', 'category', 'featured', 'draft', 'cover', 'en', 'attachments']);
const EN_KEYS = new Set(['title', 'description', 'tags']);
const ATTACHMENT_KEYS = new Set(['file', 'kind', 'id', 'label']);

function issue(code, file, message, line) {
  return line ? { code, file, line, message } : { code, file, message };
}

function normalizeText(input) {
  const changes = [];
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
    changes.push('strip-bom');
  }
  if (text.includes('\r')) {
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    changes.push('to-lf');
  }
  if (!text.endsWith('\n')) {
    text += '\n';
    changes.push('trailing-newline');
  }
  return { text, changes };
}

function parseAttrs(raw) {
  const attrs = {};
  const re = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|\{[^{}]*\})/g;
  let matched = false;
  const leftovers = raw.replace(/\/\s*$/, '').replace(re, (_all, name, value) => {
    matched = true;
    attrs[name] = value;
    return ' ';
  });
  if (leftovers.trim()) return { error: leftovers.trim().slice(0, 80) };
  return { attrs, matched };
}

function attrValue(token) {
  if (!token) return '';
  if (token.startsWith('"') || token.startsWith("'")) return token.slice(1, -1);
  return token;
}

export function scanBody(text, { file, components, slug }) {
  const errors = [];
  const warnings = [];
  const images = [];
  const markers = [];
  const labFrames = [];
  const noteLinks = [];
  const masked = maskInactive(text);

  if (/^\s*---\s*$/m.test(text.split('\n')[0] ?? '')) {
    errors.push(issue('body-frontmatter', file, '正文含有 frontmatter。元数据只放 meta.json，脚本不会删掉这段再发表。', 1));
  }
  if (text.trim() === '') errors.push(issue('empty-body', file, '正文是空的'));

  if (/(^|\n)[ \t]*import[ \t]/.test(masked) || /import\s*\(/.test(masked)) {
    errors.push(issue('mdx-import', file, '正文不能写 import。已有组件由站点按标签注入，脚本不执行这段代码。'));
  }
  if (/(^|\n)[ \t]*export[ \t]/.test(masked)) {
    errors.push(issue('mdx-export', file, '正文不能写 export。'));
  }
  if (/(^|\n)#[ \t]+\S/.test(masked)) {
    errors.push(issue('h1', file, '正文不要用一级标题。文章标题来自 meta.json 的 title，小节用 ## 。'));
  }
  if (/\$\$|\\\(|\\\)|\\\[|\\\]/.test(masked)) {
    errors.push(issue('math-unsupported', file, '本站没有 KaTeX。公式写成 <p class="eq">，下标用 <sub>，上标用 <sup>。脚本不会补公式。'));
  }
  const placeholderScan = masked.replace(/\{\{attachment:[a-z0-9]+(?:-[a-z0-9]+)*\}\}/g, '');
  if (placeholderScan.includes('{{')) {
    errors.push(issue('placeholder', file, '正文还留着 {{...}} 占位。脚本不会填这些内容。'));
  }
  if (text.length > 600 && !/(^|\n)##[ \t]+\S/.test(masked)) {
    warnings.push(issue('no-h2', file, '较长的笔记通常用 ## 分节。这次不改结构。'));
  }

  for (const match of masked.matchAll(/\{\{attachment:([a-z0-9]+(?:-[a-z0-9]+)*)\}\}/g)) {
    markers.push({ id: match[1], index: match.index });
  }

  let cursor = 0;
  while (cursor < masked.length) {
    if (masked[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (masked.startsWith('{{attachment:', cursor)) {
      const endMarker = masked.indexOf('}}', cursor + 2);
      if (endMarker > 0) {
        cursor = endMarker + 2;
        continue;
      }
    }
    if (masked[cursor] !== '{') {
      cursor += 1;
      continue;
    }
    const end = masked.indexOf('}', cursor + 1);
    if (end < 0) {
      errors.push(issue('mdx-expression', file, '有未闭合的 { 。', lineOf(text, cursor)));
      break;
    }
    const expr = masked.slice(cursor + 1, end).trim();
    if (expr !== '' && !/^(?:true|false|\d+(?:\.\d+)?)$/.test(expr)) {
      errors.push(issue(
        'mdx-expression',
        file,
        `不接受表达式 {${expr.slice(0, 40)}}。只允许 {数字}、{true}、{false}。普通花括号写成 \\{ \\}。脚本不执行表达式。`,
        lineOf(text, cursor),
      ));
    }
    cursor = end + 1;
  }

  const tagRe = /<(\/?)([A-Za-z][A-Za-z0-9]*)\b([^<>]*)>/g;
  let tag;
  while ((tag = tagRe.exec(masked))) {
    const closing = tag[1] === '/';
    const name = tag[2];
    const rawAttrs = tag[3];
    const line = lineOf(text, tag.index);
    const lower = name.toLowerCase();
    const component = components.includes(name);
    const html = HTML_TAG_SET.has(lower) && name === lower;
    if (!component && !html) {
      errors.push(issue('unknown-tag', file, `不支持 <${name}>。组件只能用站点已经注册的标签，不能注入脚本或新组件。`, line));
      continue;
    }
    if (closing) continue;
    const parsed = parseAttrs(rawAttrs);
    if (parsed.error) {
      errors.push(issue('bad-attrs', file, `<${name}> 的属性无法安全解析：${parsed.error}`, line));
      continue;
    }
    for (const key of Object.keys(parsed.attrs)) {
      if (/^on/i.test(key)) errors.push(issue('event-handler', file, `<${name}> 含事件属性 ${key}`, line));
    }
    if (name === 'Figure') {
      const src = attrValue(parsed.attrs.src);
      const alt = attrValue(parsed.attrs.alt);
      if (!parsed.attrs.src || !src) errors.push(issue('figure-src', file, 'Figure 缺少 src', line));
      else images.push({ src, file, line });
      if (!parsed.attrs.alt || !alt.trim()) errors.push(issue('figure-alt', file, 'Figure 缺少 alt', line));
      if (!parsed.attrs.caption) warnings.push(issue('figure-caption', file, 'Figure 没有 caption。已发布笔记的图注写在 caption 上。这次不补。', line));
    }
    if (name === 'LabFrame') {
      const src = attrValue(parsed.attrs.src);
      const title = attrValue(parsed.attrs.title);
      if (!title.trim()) errors.push(issue('lab-title', file, 'LabFrame 缺少 title', line));
      const match = /^\/lab\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)\.html$/.exec(src);
      if (!match) errors.push(issue('lab-src', file, 'LabFrame src 只能是 /lab/<slug>/<id>.html', line));
      else if (match[1] !== slug) errors.push(issue('lab-src', file, `LabFrame 只能嵌入本篇的沙盒，不能指向 ${match[1]}`, line));
      else labFrames.push({ id: match[2], file, line });
    }
    if (lower === 'a') {
      const href = attrValue(parsed.attrs.href);
      if (href) noteLinkOrUrl(href, { file, line, errors, warnings, noteLinks, slug });
    }
  }

  for (const match of masked.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    warnings.push(issue('markdown-image', file, '正文有 Markdown 图片。本站配图用 <Figure>，这样走现有图框和角标。这次不改写成 Figure。', lineOf(text, match.index)));
    images.push({ src: match[2], file, line: lineOf(text, match.index) });
  }
  for (const match of masked.matchAll(/(^|[^!])\[[^\]]*\]\(([^)\s]+)\)/g)) {
    noteLinkOrUrl(match[2], { file, line: lineOf(text, match.index), errors, warnings, noteLinks, slug });
  }

  const eqRe = /<p\b([^>]*\bclass\s*=\s*["'][^"']*\beq\b[^"']*["'][^>]*)>([\s\S]*?)<\/p>/gi;
  let eq;
  while ((eq = eqRe.exec(masked))) {
    if (eq[2].trim() === '') {
      errors.push(issue('empty-equation', file, '有一条空的 <p class="eq">。脚本不会编造公式。', lineOf(text, eq.index)));
    }
  }
  return { errors, warnings, images, markers, labFrames, noteLinks };
}

function noteLinkOrUrl(url, { file, line, errors, warnings, noteLinks, slug }) {
  const verdict = classifyUrl(url);
  if (!verdict.ok) {
    if (verdict.reason === 'relative') {
      warnings.push(issue('relative-link', file, `相对链接 ${url} 不会在本站路由下解析。这次不改写。`, line));
      return;
    }
    errors.push(issue('bad-link', file, `链接不被接受（${verdict.reason}）：${url}`, line));
    return;
  }
  if (verdict.kind === 'external') {
    warnings.push(issue('external-link', file, `外链未审，请人工确认：${url}`, line));
  }
  const note = /^\/notes\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)\.html$/.exec(url);
  if (note) {
    if (note[1] !== slug) errors.push(issue('note-src', file, `说明附件链接只能指向本篇 /notes/${slug}/`, line));
    else noteLinks.push({ id: note[2], file, line });
  }
}

function checkPostLinks(text, file, repoRoot, ownSlug, warnings) {
  const masked = maskInactive(text);
  for (const match of masked.matchAll(/\((\/(?:en\/)?posts\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?)\)/g)) {
    const slug = match[2];
    if (slug === ownSlug) continue;
    const en = match[1].startsWith('/en/');
    const base = en
      ? path.join(repoRoot, 'src/content/posts/en', slug)
      : path.join(repoRoot, 'src/content/posts', slug);
    if (!fs.existsSync(`${base}.mdx`) && !fs.existsSync(`${base}.md`)) {
      warnings.push(issue('missing-post-link', file, `站内链接 ${match[1]} 还没有对应稿件。若是预告下一篇，可以保留。`, lineOf(text, match.index)));
    }
  }
}

function validateMeta(raw, conventions, now) {
  const errors = [];
  const warnings = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { errors: [issue('meta-type', 'meta.json', 'meta.json 必须是对象')], warnings, meta: null };
  }
  for (const key of Object.keys(raw)) {
    if (!META_KEYS.has(key)) warnings.push(issue('unknown-meta', 'meta.json', `忽略未知字段 ${key}`));
  }
  const required = ['slug', 'title', 'description', 'pubDate', 'tags', 'featured', 'draft'];
  for (const key of required) {
    if (raw[key] === undefined) errors.push(issue('missing-field', 'meta.json', `缺少 ${key}。脚本不会猜测。`));
  }
  const meta = {};
  if (typeof raw.slug !== 'string' || !SLUG_RE.test(raw.slug) || raw.slug.length > 80 || RESERVED_SLUGS.has(raw.slug)) {
    errors.push(issue('bad-slug', 'meta.json', 'slug 只能是小写字母、数字和连字符，例如 pdn-target-impedance。'));
  } else meta.slug = raw.slug;

  for (const key of ['title', 'description']) {
    if (typeof raw[key] !== 'string' || raw[key].trim() === '' || /[\r\n]/.test(raw[key])) {
      errors.push(issue('bad-text', 'meta.json', `${key} 必须是单行非空字符串`));
    } else if (raw[key].includes('{{')) {
      errors.push(issue('placeholder', 'meta.json', `${key} 仍是占位符`));
    } else meta[key] = raw[key];
  }
  if (typeof meta.title === 'string' && meta.title.length > 160) {
    errors.push(issue('title-length', 'meta.json', 'title 超过 160 个字符'));
  }
  if (typeof meta.description === 'string' && meta.description.length > 600) {
    errors.push(issue('description-length', 'meta.json', 'description 超过 600 个字符。它是列表页的一句导语。'));
  } else if (typeof meta.description === 'string' && meta.description.length > 280) {
    warnings.push(issue('description-length', 'meta.json', 'description 偏长。列表页只用这一句。'));
  }

  if (raw.pubDate !== undefined) {
    if (raw.pubDate === 'today') meta.pubDate = shanghaiDate(now);
    else if (typeof raw.pubDate === 'string' && isCalendarDate(raw.pubDate)) meta.pubDate = raw.pubDate;
    else errors.push(issue('bad-date', 'meta.json', 'pubDate 只能是 YYYY-MM-DD，或字符串 today（按 Asia/Shanghai）。不要写带时区的时间。'));
  }
  if (raw.updatedDate !== undefined) {
    if (typeof raw.updatedDate === 'string' && isCalendarDate(raw.updatedDate)) meta.updatedDate = raw.updatedDate;
    else errors.push(issue('bad-date', 'meta.json', 'updatedDate 只能是 YYYY-MM-DD'));
  }
  if (meta.pubDate && meta.updatedDate && meta.updatedDate < meta.pubDate) {
    warnings.push(issue('date-order', 'meta.json', 'updatedDate 早于 pubDate'));
  }

  if (raw.tags !== undefined) {
    const tags = checkTags(raw.tags, 'meta.json', errors);
    if (tags) {
      meta.tags = tags;
      if (tags.length === 0) warnings.push(issue('no-tags', 'meta.json', 'tags 是空的。可以发表，列表上不会有标签。'));
    }
  }
  if (raw.category === undefined || raw.category === '') {
    warnings.push(issue('no-category', 'meta.json', '没有 category。首页栏目不会收录这篇。脚本不会挑一个栏目。'));
  } else if (typeof raw.category !== 'string' || !conventions.categories.includes(raw.category)) {
    errors.push(issue('bad-category', 'meta.json', `category 只能是 ${conventions.categories.join(' / ')}`));
  } else meta.category = raw.category;

  if (raw.featured !== undefined && typeof raw.featured !== 'boolean') {
    errors.push(issue('bad-boolean', 'meta.json', 'featured 必须是 JSON 布尔值'));
  } else meta.featured = raw.featured;
  if (raw.draft !== undefined && typeof raw.draft !== 'boolean') {
    errors.push(issue('bad-boolean', 'meta.json', 'draft 必须是 JSON 布尔值'));
  } else meta.draft = raw.draft;

  if (raw.cover !== undefined) {
    if (typeof raw.cover !== 'string') errors.push(issue('bad-cover', 'meta.json', 'cover 必须是站内图片路径'));
    else meta.cover = raw.cover;
  }

  if (raw.en !== undefined) {
    if (!raw.en || typeof raw.en !== 'object' || Array.isArray(raw.en)) {
      errors.push(issue('bad-en', 'meta.json', 'en 必须是对象，且要自带 title、description、tags'));
    } else {
      for (const key of Object.keys(raw.en)) {
        if (!EN_KEYS.has(key)) warnings.push(issue('unknown-meta', 'meta.json', `忽略 en.${key}`));
      }
      const en = {};
      for (const key of ['title', 'description']) {
        if (typeof raw.en[key] !== 'string' || raw.en[key].trim() === '' || raw.en[key].includes('{{')) {
          errors.push(issue('en-meta', 'meta.json', `英文稿需要自己的 ${key}。脚本不翻译、也不抄中文。`));
        } else en[key] = raw.en[key];
      }
      const tags = checkTags(raw.en.tags, 'meta.json', errors, 'en.tags');
      if (tags) en.tags = tags;
      meta.en = en;
    }
  }

  meta.attachments = [];
  if (raw.attachments !== undefined) {
    if (!Array.isArray(raw.attachments)) errors.push(issue('bad-attachments', 'meta.json', 'attachments 必须是数组'));
    else {
      const seen = new Set();
      for (const item of raw.attachments) {
        if (!item || typeof item !== 'object') {
          errors.push(issue('bad-attachments', 'meta.json', '附件条目必须是对象'));
          continue;
        }
        for (const key of Object.keys(item)) {
          if (!ATTACHMENT_KEYS.has(key)) warnings.push(issue('unknown-meta', 'meta.json', `忽略附件字段 ${key}`));
        }
        if (typeof item.id !== 'string' || !SLUG_RE.test(item.id)) {
          errors.push(issue('bad-attachment-id', 'meta.json', '附件 id 只能是小写字母、数字和连字符'));
          continue;
        }
        if (seen.has(item.id)) errors.push(issue('duplicate-attachment', 'meta.json', `附件 id 重复：${item.id}`));
        seen.add(item.id);
        if (item.kind !== 'static' && item.kind !== 'interactive') {
          errors.push(issue('attachment-kind', 'meta.json', `${item.id} 的 kind 只能是 static 或 interactive`));
        }
        if (typeof item.file !== 'string') errors.push(issue('attachment-file', 'meta.json', `${item.id} 缺少 file`));
        if (typeof item.label !== 'string' || item.label.trim() === '' || /[<>\]"]/.test(item.label)) {
          errors.push(issue('attachment-label', 'meta.json', `${item.id} 需要纯文本 label，供链接或沙盒标题使用`));
        }
        meta.attachments.push({
          id: item.id,
          kind: item.kind,
          file: item.file,
          label: typeof item.label === 'string' ? item.label : '',
        });
      }
    }
  }
  return { errors, warnings, meta };
}

function checkTags(value, file, errors, label = 'tags') {
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string' || tag.trim() === '' || /[\r\n]/.test(tag))) {
    errors.push(issue('bad-tags', file, `${label} 必须是非空字符串数组，可以为 []`));
    return null;
  }
  if (value.length > 20) errors.push(issue('bad-tags', file, `${label} 超过 20 个`));
  const slugs = new Map();
  for (const tag of value) {
    if (tag.length > 80) errors.push(issue('bad-tags', file, `标签过长：${tag.slice(0, 40)}`));
    const slug = slugifyTag(tag);
    if (!slug) errors.push(issue('bad-tags', file, `标签无法变成路径：${tag}`));
    else if (slugs.has(slug) && slugs.get(slug) !== tag) {
      errors.push(issue('tag-slug-collision', file, `标签「${slugs.get(slug)}」和「${tag}」会落到同一个标签页`));
    } else slugs.set(slug, tag);
  }
  if (value.length === 0) return [];
  return value;
}

function safeInputPath(inputRoot, rel) {
  if (typeof rel !== 'string' || rel === '' || path.isAbsolute(rel) || rel.includes('\\') || rel.split('/').includes('..')) {
    return { error: 'path-escape' };
  }
  const abs = path.resolve(inputRoot, rel);
  if (!inside(inputRoot, abs)) return { error: 'path-escape' };
  return { abs };
}

function readInside(inputRoot, abs, limit, binary) {
  if (!fs.existsSync(abs)) return { error: 'missing' };
  const root = fs.realpathSync(inputRoot);
  const real = fs.realpathSync(abs);
  if (!inside(root, real)) return { error: 'path-escape' };
  const stat = fs.statSync(real);
  if (!stat.isFile()) return { error: 'not-file' };
  if (stat.size > limit) return { error: 'too-large' };
  if (binary) return { data: fs.readFileSync(real) };
  const text = fs.readFileSync(real, 'utf8');
  if (text.includes('\0')) return { error: 'binary' };
  return { text };
}

function pickBody(inputRoot, stem) {
  const mdx = path.join(inputRoot, `${stem}.mdx`);
  const md = path.join(inputRoot, `${stem}.md`);
  const hasMdx = fs.existsSync(mdx);
  const hasMd = fs.existsSync(md);
  if (hasMdx && hasMd) return { error: `同时存在 ${stem}.md 与 ${stem}.mdx` };
  if (hasMdx) return { abs: mdx, rel: `${stem}.mdx` };
  if (hasMd) return { abs: md, rel: `${stem}.md` };
  return { abs: null, rel: null };
}

function imageExtension(src) {
  return path.posix.extname(src).toLowerCase();
}

function resolveImage(src, inputRoot, repoRoot) {
  if (!IMAGE_SRC.test(src) || src.split('/').includes('..')) {
    return { error: `图片路径不被接受：${src}`, code: 'bad-resource' };
  }
  const ext = imageExtension(src);
  if (!IMAGE_EXT.has(ext)) return { error: `图片只接受 png / jpg / jpeg / webp / gif：${src}`, code: 'bad-resource' };
  const rel = src.slice(1);
  const base = path.posix.basename(rel);
  const candidates = [path.join(inputRoot, rel), path.join(inputRoot, 'images', base)];
  const found = [];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const read = readInside(inputRoot, candidate, IMAGE_LIMIT, true);
    if (read.error === 'path-escape') return { error: `图片路径越界：${src}`, code: 'path-escape' };
    if (read.error) return { error: `无法读取图片 ${src}（${read.error}）`, code: 'missing-resource' };
    found.push(read.data);
  }
  if (found.length === 2 && !found[0].equals(found[1])) {
    return { error: `图片有两份不同内容：${src}`, code: 'conflict' };
  }
  const dest = path.resolve(repoRoot, 'public', rel);
  if (!inside(path.join(repoRoot, 'public/images'), dest)) return { error: `图片目标越界：${src}`, code: 'path-escape' };
  const existing = fs.existsSync(dest) ? fs.readFileSync(dest) : null;
  if (found.length === 0) {
    if (existing) return { reuse: true, dest, rel: path.posix.join('public', rel) };
    return { error: `找不到图片 ${src}。请放进稿件目录的 ${rel}，或确认 public/${rel} 已经存在。`, code: 'missing-resource' };
  }
  if (existing && !existing.equals(found[0])) return { error: `图片与已有文件冲突：public/${rel}`, code: 'conflict' };
  return { data: found[0], dest, rel: path.posix.join('public', rel), unchanged: Boolean(existing) };
}

function renderPost(meta, body, lang) {
  const title = lang === 'en' ? meta.en.title : meta.title;
  const description = lang === 'en' ? meta.en.description : meta.description;
  const tags = lang === 'en' ? meta.en.tags : meta.tags;
  const lines = ['---', `title: ${yamlQuote(title)}`, `description: ${yamlQuote(description)}`, `pubDate: ${meta.pubDate}`];
  if (meta.updatedDate) lines.push(`updatedDate: ${meta.updatedDate}`);
  lines.push(`tags: [${tags.map((tag) => yamlQuote(tag)).join(', ')}]`);
  if (meta.category) lines.push(`category: ${yamlQuote(meta.category)}`);
  lines.push(`featured: ${meta.featured ? 'true' : 'false'}`);
  lines.push(`draft: ${meta.draft ? 'true' : 'false'}`);
  if (meta.cover) lines.push(`cover: ${yamlQuote(meta.cover)}`);
  lines.push('---');
  const text = body.endsWith('\n') ? body : `${body}\n`;
  return `${lines.join('\n')}\n\n${text}`;
}

function expandMarkers(text, lookup) {
  const masked = maskInactive(text);
  const changes = [];
  let out = '';
  let last = 0;
  const re = /\{\{attachment:([a-z0-9]+(?:-[a-z0-9]+)*)\}\}/g;
  let match;
  while ((match = re.exec(text))) {
    const visible = masked.slice(match.index, match.index + match[0].length).includes('{');
    if (!visible) continue;
    const replacement = lookup(match[1]);
    if (replacement == null) continue;
    out += text.slice(last, match.index) + replacement;
    last = match.index + match[0].length;
    changes.push(`attachment-marker:${match[1]}`);
  }
  out += text.slice(last);
  return { text: out, changes };
}

function stageText(dest, rel, content, { replaceable, replace }) {
  if (fs.existsSync(dest)) {
    const prev = fs.readFileSync(dest, 'utf8');
    if (prev === content) return { rel, action: 'unchanged' };
    if (!replaceable || !replace) return { rel, action: 'conflict' };
  }
  return { rel, dest, content, action: 'write' };
}

function forbiddenInput(repoRoot, inputReal) {
  const banned = ['src', 'public', '.git'].map((name) => path.join(repoRoot, name));
  if (path.resolve(inputReal) === path.resolve(repoRoot)) return '稿件目录不能是仓库根目录';
  for (const dir of banned) {
    if (fs.existsSync(dir) && inside(dir, inputReal)) return `稿件目录不能放在 ${path.basename(dir)}/ 里面`;
  }
  return null;
}

function defaultRunGit(repo, args, env) {
  assertSafeGit(args);
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    timeout: args[0] === 'push' ? 60_000 : 30_000,
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error((result.stderr || result.stdout || `git ${args[0]} 失败`).trim());
    error.status = result.status;
    throw error;
  }
  return result.stdout ?? '';
}

function gitTry(run, repo, args, env) {
  try {
    return { ok: true, stdout: run(repo, args, env) };
  } catch (error) {
    return { ok: false, error };
  }
}

function defaultBuild(repo) {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: repo,
    encoding: 'utf8',
    timeout: 180_000,
    env: process.env,
  });
  const log = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  const tail = log.split('\n').slice(-40).join('\n');
  if (result.error || result.status !== 0) return { ok: false, log: tail || result.error?.message || 'build failed' };
  return { ok: true, log: '' };
}

async function compileBody(body) {
  const { compile } = await import('@mdx-js/mdx');
  let remarkPlugins = [];
  try {
    const gfm = await import('remark-gfm');
    remarkPlugins = [gfm.default];
  } catch {
    remarkPlugins = [];
  }
  await compile(body, { jsx: true, remarkPlugins });
}

function featuredOthers(repoRoot, slug) {
  const dirs = [path.join(repoRoot, 'src/content/posts'), path.join(repoRoot, 'src/content/posts/en')];
  const found = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!/\.mdx?$/.test(name)) continue;
      const id = name.replace(/\.mdx?$/, '');
      if (id === slug) continue;
      const head = fs.readFileSync(path.join(dir, name), 'utf8').slice(0, 2500);
      if (/^featured:\s*true\s*$/m.test(head)) found.push(path.basename(dir) === 'en' ? `en/${id}` : id);
    }
  }
  return [...new Set(found)];
}

function finish(base) {
  return {
    ok: base.errors.length === 0,
    slug: base.slug ?? null,
    pubDate: base.pubDate ?? null,
    timezone: 'Asia/Shanghai',
    dryRun: Boolean(base.dryRun),
    draft: base.draft ?? null,
    wrote: base.wrote ?? [],
    unchanged: base.unchanged ?? [],
    planned: base.planned ?? [],
    normalized: base.normalized ?? [],
    warnings: base.warnings ?? [],
    errors: base.errors ?? [],
    review: [REVIEW_NOTE],
    unsupported: UNSUPPORTED,
    deploy: base.deploy ?? { ok: false, triggered: false, detail: '未检查' },
    build: base.build ?? { requested: false, ran: false, ok: null },
    git: base.git ?? { requested: false, committed: false, pushed: false, merged: false },
    attachments: base.attachments ?? [],
  };
}

export async function publish(options) {
  const repoRoot = path.resolve(options.repoRoot);
  const dryRun = Boolean(options.dryRun);
  const replace = Boolean(options.replace);
  const commit = Boolean(options.commit);
  const push = Boolean(options.push);
  const buildRequested = Boolean(options.build || commit);
  const now = options.now instanceof Date ? options.now : new Date();
  const runGit = options.runGit ?? defaultRunGit;
  const buildRunner = options.buildRunner ?? defaultBuild;
  const errors = [];
  const warnings = [];
  const normalized = [];

  if (!options.inputDir) {
    return finish({ errors: [issue('usage', '-', '需要 --input 稿件目录')], dryRun, deploy: { triggered: false, ok: false } });
  }
  const inputRoot = path.resolve(options.inputDir);
  if (!fs.existsSync(inputRoot) || !fs.statSync(inputRoot).isDirectory()) {
    return finish({ errors: [issue('input-missing', options.inputDir, '稿件目录不存在')], dryRun });
  }
  const inputReal = fs.realpathSync(inputRoot);
  const banned = forbiddenInput(repoRoot, inputReal);
  if (banned) return finish({ errors: [issue('input-location', inputRoot, banned)], dryRun });

  let conventions;
  try {
    conventions = loadConventions(repoRoot);
  } catch (error) {
    return finish({ errors: [issue('conventions', 'src/consts.ts', error.message)], dryRun });
  }
  const deploy = readDeployContract(repoRoot);
  if (!deploy.ok) warnings.push(issue('deploy-contract', '.github/workflows/deploy.yml', deploy.detail));

  const metaPath = path.join(inputRoot, 'meta.json');
  if (!fs.existsSync(metaPath)) return finish({ errors: [issue('missing-meta', 'meta.json', '缺少 meta.json')], warnings, dryRun, deploy });
  const metaRead = readInside(inputRoot, metaPath, 100_000, false);
  if (metaRead.error) return finish({ errors: [issue('meta-read', 'meta.json', `无法读取 meta.json（${metaRead.error}）`)], warnings, dryRun, deploy });
  let raw;
  try {
    raw = JSON.parse(metaRead.text);
  } catch (error) {
    return finish({ errors: [issue('meta-json', 'meta.json', `JSON 无法解析：${error.message}`)], warnings, dryRun, deploy });
  }
  const validated = validateMeta(raw, conventions, now);
  errors.push(...validated.errors);
  warnings.push(...validated.warnings);
  const meta = validated.meta;
  if (!meta?.slug || !meta.pubDate || errors.some((item) => item.file === 'meta.json' && item.code !== 'unknown-meta')) {
    if (!meta) return finish({ errors, warnings, dryRun, deploy });
  }

  const bodyPick = pickBody(inputRoot, 'body');
  const enPick = pickBody(inputRoot, 'body.en');
  if (bodyPick.error) errors.push(issue('body-file', 'body.mdx', bodyPick.error));
  if (enPick.error) errors.push(issue('body-file', 'body.en.mdx', enPick.error));
  if (!bodyPick.abs) errors.push(issue('missing-body', 'body.mdx', '需要中文正文 body.mdx 或 body.md。脚本不接受只有英文的稿，也不翻译。'));
  if (Boolean(enPick.abs) !== Boolean(meta?.en)) {
    errors.push(issue('en-pair', enPick.abs ? 'body.en.mdx' : 'meta.json', '英文正文和 meta.en 必须同时提供。脚本不翻译，也不用中文冒充英文。'));
  }

  let body = null;
  let enBody = null;
  if (bodyPick.abs) {
    const read = readInside(inputRoot, bodyPick.abs, BODY_LIMIT, false);
    if (read.error) errors.push(issue('body-read', bodyPick.rel, `无法读取正文（${read.error}）`));
    else body = normalizeText(read.text);
  }
  if (enPick.abs && meta?.en) {
    const read = readInside(inputRoot, enPick.abs, BODY_LIMIT, false);
    if (read.error) errors.push(issue('body-read', enPick.rel, `无法读取英文正文（${read.error}）`));
    else enBody = normalizeText(read.text);
  }
  if (body?.changes.length) normalized.push({ file: bodyPick.rel, changes: body.changes });
  if (enBody?.changes.length) normalized.push({ file: enPick.rel, changes: enBody.changes });

  const scans = [];
  if (body && meta?.slug) {
    const scan = scanBody(body.text, { file: bodyPick.rel, components: conventions.components, slug: meta.slug });
    errors.push(...scan.errors);
    warnings.push(...scan.warnings);
    checkPostLinks(body.text, bodyPick.rel, repoRoot, meta.slug, warnings);
    scans.push({ lang: 'zh', file: bodyPick.rel, scan, body });
  }
  if (enBody && meta?.slug) {
    const scan = scanBody(enBody.text, { file: enPick.rel, components: conventions.components, slug: meta.slug });
    errors.push(...scan.errors);
    warnings.push(...scan.warnings);
    checkPostLinks(enBody.text, enPick.rel, repoRoot, meta.slug, warnings);
    scans.push({ lang: 'en', file: enPick.rel, scan, body: enBody });
  }

  const attachmentOutputs = new Map();
  if (meta?.attachments && meta.slug) {
    for (const item of meta.attachments) {
      const located = safeInputPath(inputRoot, item.file);
      if (located.error) {
        errors.push(issue('path-escape', 'meta.json', `附件 ${item.id} 的 file 越出稿件目录`));
        continue;
      }
      const read = readInside(inputRoot, located.abs, HTML_LIMIT, false);
      if (read.error === 'missing') {
        errors.push(issue('missing-attachment', item.file, `找不到附件 ${item.file}`));
        continue;
      }
      if (read.error) {
        errors.push(issue('attachment-read', item.file, `无法读取附件（${read.error}）`));
        continue;
      }
      const inspected = inspectAttachment(item.kind, read.text, item.label);
      for (const problem of inspected.errors) errors.push(issue(problem.code, item.file, problem.message));
      for (const problem of inspected.warnings) warnings.push(issue(problem.code, item.file, problem.message));
      if (inspected.changes.length) normalized.push({ file: item.file, changes: inspected.changes });
      if (inspected.output) attachmentOutputs.set(item.id, { ...item, output: inspected.output });
    }
  }

  const referenced = new Set();
  for (const entry of scans) {
    const { scan } = entry;
    for (const marker of scan.markers) {
      const item = attachmentOutputs.get(marker.id) ?? meta?.attachments?.find((entryItem) => entryItem.id === marker.id);
      if (!item) errors.push(issue('missing-attachment', entry.file, `正文引用了不存在的附件 ${marker.id}`));
      else referenced.add(marker.id);
    }
    for (const frame of scan.labFrames) {
      const item = meta?.attachments?.find((entry) => entry.id === frame.id);
      if (!item) errors.push(issue('missing-attachment', frame.file, `LabFrame 没有对应附件 ${frame.id}`));
      else if (item.kind !== 'interactive') errors.push(issue('attachment-kind', frame.file, `${frame.id} 是说明附件，不能放进 LabFrame`));
      else referenced.add(frame.id);
    }
    for (const note of scan.noteLinks) {
      const item = meta?.attachments?.find((entry) => entry.id === note.id);
      if (!item) errors.push(issue('missing-attachment', note.file, `说明链接没有对应附件 ${note.id}`));
      else if (item.kind !== 'static') errors.push(issue('attachment-kind', note.file, `${note.id} 是交互附件，不能当作说明页链接`));
      else referenced.add(note.id);
    }
  }
  for (const item of meta?.attachments ?? []) {
    if (!referenced.has(item.id)) {
      warnings.push(issue('unreferenced-attachment', item.file ?? 'meta.json', `附件 ${item.id} 没有被正文用到，这次不写出。`));
    }
  }

  const imagePlan = new Map();
  const imageSources = [];
  for (const { scan } of scans) imageSources.push(...scan.images);
  if (meta?.cover) imageSources.push({ src: meta.cover, file: 'meta.json', line: undefined });
  for (const image of imageSources) {
    if (imagePlan.has(image.src)) continue;
    const resolved = resolveImage(image.src, inputRoot, repoRoot);
    if (resolved.error) errors.push(issue(resolved.code || 'missing-resource', image.file, resolved.error, image.line));
    else imagePlan.set(image.src, resolved);
  }

  if (meta?.featured === true && meta.slug) {
    const others = featuredOthers(repoRoot, meta.slug);
    const extra = others.length ? ` 已有置顶：${others.join(', ')}。` : '';
    warnings.push(issue('featured', 'meta.json', `featured 为 true 时，这篇会参与首页 hero。脚本不会改其他文章。${extra}`));
  }

  if (errors.length || !body || !meta?.slug || !meta.pubDate || typeof meta.featured !== 'boolean' || typeof meta.draft !== 'boolean') {
    return finish({ errors, warnings, normalized, slug: meta?.slug, pubDate: meta?.pubDate, draft: meta?.draft, dryRun, deploy });
  }

  const lookup = (id) => {
    const item = attachmentOutputs.get(id);
    if (!item || !referenced.has(id)) return null;
    if (item.kind === 'interactive') {
      return `<LabFrame src="/lab/${meta.slug}/${item.id}.html" title=${yamlQuote(item.label)} />`;
    }
    return `[${item.label}](/notes/${meta.slug}/${item.id}.html)`;
  };
  const zhExpanded = expandMarkers(body.text, lookup);
  const enExpanded = enBody ? expandMarkers(enBody.text, lookup) : null;
  if (zhExpanded.changes.length) normalized.push({ file: bodyPick.rel, changes: zhExpanded.changes });
  if (enExpanded?.changes.length) normalized.push({ file: enPick.rel, changes: enExpanded.changes });

  const documents = [{ lang: 'zh', body: zhExpanded.text, rel: `src/content/posts/${meta.slug}.mdx` }];
  if (enExpanded) documents.push({ lang: 'en', body: enExpanded.text, rel: `src/content/posts/en/${meta.slug}.mdx` });

  if (options.mdx !== 'off' && errors.length === 0) {
    for (const doc of documents) {
      try {
        await compileBody(doc.body);
      } catch (error) {
        const message = String(error.message || error).split('\n')[0].slice(0, 400);
        errors.push(issue('mdx-compile', doc.rel, `MDX 无法编译：${message}`));
      }
    }
  }
  if (errors.length) {
    return finish({ errors, warnings, normalized, slug: meta.slug, pubDate: meta.pubDate, draft: meta.draft, dryRun, deploy });
  }

  const staged = [];
  for (const doc of documents) {
    const dest = path.resolve(repoRoot, doc.rel);
    if (!inside(path.join(repoRoot, 'src/content/posts'), dest)) {
      return finish({ errors: [issue('path-escape', doc.rel, '文章输出路径越界')], warnings, slug: meta.slug, dryRun, deploy });
    }
    staged.push({ ...stageText(dest, doc.rel, renderPost(meta, doc.body, doc.lang), { replaceable: true, replace }), kind: 'post' });
  }
  for (const item of attachmentOutputs.values()) {
    if (!referenced.has(item.id)) continue;
    const rel = item.kind === 'interactive'
      ? `src/content/labs/${meta.slug}/${item.id}.html`
      : `public/notes/${meta.slug}/${item.id}.html`;
    const dest = path.resolve(repoRoot, rel);
    const root = item.kind === 'interactive' ? path.join(repoRoot, 'src/content/labs') : path.join(repoRoot, 'public/notes');
    if (!inside(root, dest)) {
      errors.push(issue('path-escape', item.file, '附件输出路径越界'));
      continue;
    }
    staged.push({ ...stageText(dest, rel, item.output, { replaceable: true, replace }), kind: item.kind });
  }
  for (const resolved of imagePlan.values()) {
    if (resolved.reuse || resolved.unchanged) {
      staged.push({ rel: resolved.rel, action: 'unchanged', kind: 'image' });
      continue;
    }
    staged.push({ rel: resolved.rel, dest: resolved.dest, content: resolved.data, action: 'write', kind: 'image' });
  }

  const conflicts = staged.filter((item) => item.action === 'conflict');
  if (conflicts.length) {
    for (const item of conflicts) {
      errors.push(issue('conflict', item.rel, '目标已存在且内容不同。默认不覆盖。文章和本篇 HTML 附件可显式传 --replace；图片冲突请换文件名。'));
    }
    return finish({ errors, warnings, normalized, slug: meta.slug, pubDate: meta.pubDate, draft: meta.draft, dryRun, deploy });
  }

  const writeSet = staged.filter((item) => item.action === 'write');
  const unchanged = staged.filter((item) => item.action === 'unchanged').map((item) => item.rel);
  const plannedRels = writeSet.map((item) => item.rel);
  let git = { requested: commit, committed: false, pushed: false, merged: false };
  let branchNow = null;
  if (commit) {
    const insideRepo = gitTry(runGit, repoRoot, ['rev-parse', '--is-inside-work-tree'], options.gitEnv);
    if (!insideRepo.ok || insideRepo.stdout.trim() !== 'true') {
      return finish({
        errors: [issue('not-git', 'git', '当前目录不是 Git 仓库，无法提交')],
        warnings, normalized, slug: meta.slug, pubDate: meta.pubDate, draft: meta.draft, dryRun, deploy,
        unchanged, planned: plannedRels,
      });
    }
    const status = gitTry(runGit, repoRoot, ['status', '--porcelain=v1', '--untracked-files=all'], options.gitEnv);
    if (!status.ok) {
      return finish({
        errors: [issue('git-status', 'git', status.error.message)],
        warnings, normalized, slug: meta.slug, pubDate: meta.pubDate, dryRun, deploy,
      });
    }
    if (status.stdout.trim()) {
      return finish({
        errors: [issue('dirty-workspace', 'git', '工作区不干净。--commit 要求没有其他改动，以免把无关文件带进分支。')],
        warnings, normalized, slug: meta.slug, pubDate: meta.pubDate, draft: meta.draft, dryRun, deploy,
        unchanged, planned: plannedRels,
      });
    }
    branchNow = runGit(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'], options.gitEnv).trim();
    const plannedGit = planGit({ slug: meta.slug, branchNow, files: [...new Set([...plannedRels, ...unchanged])], push });
    git = { ...git, branch: plannedGit.branch, commands: plannedGit.commands.map((command) => command.join(' ')) };
    if (branchNow !== plannedGit.branch) {
      const exists = gitTry(runGit, repoRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${plannedGit.branch}`], options.gitEnv);
      if (exists.ok) {
        return finish({
          errors: [issue('branch-exists', 'git', `分支 ${plannedGit.branch} 已存在。脚本不会重置它。`)],
          warnings, normalized, slug: meta.slug, pubDate: meta.pubDate, dryRun, deploy, git,
        });
      }
    }
  }

  if (dryRun) {
    return finish({
      errors, warnings, normalized, slug: meta.slug, pubDate: meta.pubDate, draft: meta.draft, dryRun,
      planned: plannedRels, unchanged, deploy,
      build: { requested: buildRequested, ran: false, ok: null, reason: 'dry-run' },
      git,
      attachments: [...referenced].map((id) => ({ id, kind: attachmentOutputs.get(id)?.kind, referenced: true })),
    });
  }

  for (const item of writeSet) {
    fs.mkdirSync(path.dirname(item.dest), { recursive: true });
    fs.writeFileSync(item.dest, item.content);
  }
  const wrote = writeSet.map((item) => item.rel);

  let build = { requested: buildRequested, ran: false, ok: null };
  if (buildRequested) {
    const built = await buildRunner(repoRoot);
    build = { requested: true, ran: true, ok: Boolean(built.ok), log: built.ok ? undefined : built.log };
    if (!built.ok) {
      errors.push(issue('build-failed', 'npm run build', '构建失败，没有提交。已写入的文件留在工作区。'));
      return finish({ errors, warnings, normalized, slug: meta.slug, pubDate: meta.pubDate, draft: meta.draft, wrote, unchanged, deploy, build, git });
    }
  }

  if (commit) {
    const after = runGit(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all'], options.gitEnv);
    const dirty = after.split('\n').map((line) => line.trimEnd()).filter(Boolean).map((line) => {
      let file = line.slice(3);
      if (file.includes(' -> ')) file = file.split(' -> ').pop();
      if (file.startsWith('"') && file.endsWith('"')) file = JSON.parse(file);
      return file;
    });
    const allowed = new Set(staged.map((item) => item.rel));
    const foreign = dirty.filter((file) => !allowed.has(file));
    if (foreign.length) {
      errors.push(issue('dirty-workspace', 'git', `构建后出现本次稿件以外的改动：${foreign.join(', ')}。没有提交。`));
      return finish({ errors, warnings, normalized, slug: meta.slug, pubDate: meta.pubDate, wrote, unchanged, deploy, build, git });
    }
    if (dirty.length === 0) {
      warnings.push(issue('already-current', 'git', '生成结果与现有文件一致，没有新的提交。'));
      return finish({ errors, warnings, normalized, slug: meta.slug, pubDate: meta.pubDate, draft: meta.draft, wrote, unchanged, deploy, build, git });
    }
    const commands = planGit({
      slug: meta.slug,
      branchNow,
      files: dirty,
      push: false,
    }).commands;
    try {
      for (const command of commands) runGit(repoRoot, command, options.gitEnv);
      git.committed = true;
      if (push) {
        const branch = runGit(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'], options.gitEnv).trim();
        const pushCommand = ['push', '-u', 'origin', branch];
        assertSafeGit(pushCommand);
        runGit(repoRoot, pushCommand, options.gitEnv);
        git.pushed = true;
      }
    } catch (error) {
      errors.push(issue('git-failed', 'git', error.message));
      return finish({ errors, warnings, normalized, slug: meta.slug, pubDate: meta.pubDate, wrote, unchanged, deploy, build, git });
    }
  }

  return finish({
    errors, warnings, normalized, slug: meta.slug, pubDate: meta.pubDate, draft: meta.draft,
    wrote, unchanged, deploy, build, git,
    attachments: [...referenced].map((id) => ({ id, kind: attachmentOutputs.get(id)?.kind, referenced: true })),
  });
}
