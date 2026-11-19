import fs from 'node:fs';
import path from 'node:path';

export const REVIEW_NOTE = '技术正确性、公式是否成立、以及英文是否忠实，都没有由脚本审校。';

export const UNSUPPORTED = [
  '不自动翻译，也不改写观点',
  '不补写缺失公式，不生成交互实验',
  '不审校技术正确性',
  '不创建、不合并 Pull Request',
  '不推送 main，不修改其他 slug 的已发布文章',
  '不执行正文或附件中的脚本，不读取输入目录以外的路径',
];

const HTML_TAGS = [
  'p', 'sub', 'sup', 'em', 'strong', 'br', 'code', 'a', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'hr', 'h2', 'h3', 'h4', 'pre',
];

export const HTML_TAG_SET = new Set(HTML_TAGS);

export function shanghaiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  const year = pick('year');
  const month = pick('month');
  const day = pick('day');
  if (!year || !month || !day) throw new Error('无法按 Asia/Shanghai 计算日期');
  return `${year}-${month}-${day}`;
}

export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function yamlQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function inside(parent, child) {
  const root = path.resolve(parent);
  const target = path.resolve(child);
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function slugifyTag(tag) {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[\s/]+/g, '-')
    .replace(/[^\p{L}\p{N}\-]/gu, '');
}

export function loadConventions(repoRoot) {
  const constsPath = path.join(repoRoot, 'src/consts.ts');
  const astroPath = path.join(repoRoot, 'astro.config.mjs');
  const consts = fs.readFileSync(constsPath, 'utf8');
  const start = consts.indexOf('export const CATEGORIES');
  const end = consts.indexOf('export type CategorySlug');
  if (start < 0 || end < start) {
    throw new Error('无法从 src/consts.ts 读出栏目。发布工具不会自造分类。');
  }
  const categories = [...consts.slice(start, end).matchAll(/slug:\s*'([^']+)'/g)].map((match) => match[1]);
  if (categories.length === 0) throw new Error('栏目列表为空');

  const astro = fs.readFileSync(astroPath, 'utf8');
  const widgetStart = astro.indexOf('const widgets');
  const widgetEnd = astro.indexOf('return {', widgetStart);
  if (widgetStart < 0 || widgetEnd < widgetStart) {
    throw new Error('无法从 astro.config.mjs 读出组件白名单。');
  }
  const components = [...astro.slice(widgetStart, widgetEnd).matchAll(/tag:\s*'<([A-Za-z][A-Za-z0-9]*)'/g)].map((match) => match[1]);
  if (!components.includes('Figure')) throw new Error('组件白名单缺少 Figure');
  return { categories, components };
}

export function classifyUrl(raw) {
  const url = String(raw).trim();
  if (!url || /\s/.test(url) || url.includes('\\')) return { ok: false, reason: 'malformed' };
  if (url.startsWith('#')) return { ok: true, kind: 'anchor' };
  if (url.startsWith('/')) {
    if (url.includes('..') || url.includes('//')) return { ok: false, reason: 'path' };
    return { ok: true, kind: 'site', url };
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'relative' };
  }
  if (parsed.username || parsed.password) return { ok: false, reason: 'credentials' };
  if (parsed.protocol === 'mailto:') return { ok: true, kind: 'mailto', url };
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'protocol' };
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.startsWith('127.') ||
    /^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)
  ) {
    return { ok: false, reason: 'local-host' };
  }
  return { ok: true, kind: 'external', url };
}

export function blankExceptNewlines(value) {
  return value.replace(/[^\n]/g, ' ');
}

/** 把围栏代码、行内代码和 JSX 注释涂掉，长度与换行保持不变，便于按原文下标报错。 */
export function maskInactive(text) {
  const lines = text.split('\n');
  let fence = null;
  const maskedLines = lines.map((line) => {
    if (!fence) {
      const opened = /^( {0,3})(`{3,}|~{3,})/.exec(line);
      if (opened) {
        fence = opened[2][0];
        return blankExceptNewlines(line);
      }
      return line.replace(/`[^`\n]*`/g, (token) => blankExceptNewlines(token));
    }
    const closed = new RegExp(`^ {0,3}${fence}{3,}\\s*$`).test(line);
    if (closed) fence = null;
    return blankExceptNewlines(line);
  });
  return maskedLines.join('\n').replace(/\{\/\*[\s\S]*?\*\/\}/g, (token) => blankExceptNewlines(token));
}

export function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

export function readDeployContract(repoRoot) {
  const file = path.join(repoRoot, '.github/workflows/deploy.yml');
  if (!fs.existsSync(file)) {
    return { ok: false, triggered: false, detail: '缺少 .github/workflows/deploy.yml' };
  }
  const source = fs.readFileSync(file, 'utf8');
  const onMain = /branches:\s*\[main\]/.test(source) || /-\s*main\b/.test(source);
  const build = source.includes('npm run build');
  const pages = source.includes('deploy-pages');
  return {
    ok: onMain && build && pages,
    triggered: false,
    onMain,
    build,
    pages,
    detail: '合并到 main 后仍由现有 GitHub Actions 部署。脚本不触发、不合并。',
  };
}

export function assertSafeGit(args) {
  if (!Array.isArray(args) || args.length === 0) throw new Error('空的 git 命令');
  const [command, ...rest] = args;
  const banned = new Set(['merge', 'rebase', 'reset', 'clean', 'filter-branch', 'update-ref']);
  if (banned.has(command)) throw new Error(`拒绝执行 git ${command}`);
  if (rest.some((arg) => arg === '--force' || arg === '-f' || arg === '--no-verify')) {
    throw new Error('拒绝 git 强制参数或跳过钩子');
  }
  if (command === 'push') {
    const branch = rest[rest.length - 1];
    if (branch === 'main' || branch === 'master' || branch === 'HEAD' || rest.includes('main') || rest.includes('master')) {
      throw new Error('拒绝推送 main');
    }
  }
  if (command === 'checkout' && (rest.includes('main') || rest.includes('master'))) {
    throw new Error('拒绝为了提交而切回 main');
  }
  if (command === 'add') {
    for (const file of rest.filter((arg) => arg !== '--')) {
      if (path.posix.isAbsolute(file) || path.win32.isAbsolute(file) || file.split(/[/\\]/).includes('..')) {
        throw new Error(`拒绝把仓库外路径加入提交：${file}`);
      }
    }
  }
}

export function planGit({ slug, branchNow, files, push }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('slug 不能作为分支名');
  const branch = `post/${slug}`;
  const commands = [];
  if (branchNow !== branch) commands.push(['checkout', '-b', branch]);
  commands.push(['add', '--', ...files]);
  commands.push(['commit', '-m', `发布笔记：${slug}`]);
  if (push) commands.push(['push', '-u', 'origin', branch]);
  for (const command of commands) assertSafeGit(command);
  return { branch, commands };
}
