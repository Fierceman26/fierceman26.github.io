import { classifyUrl } from './conventions.mjs';

const STATIC_TAGS = new Set([
  'p', 'sub', 'sup', 'em', 'strong', 'br', 'code', 'a', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'hr', 'h2', 'h3', 'h4', 'pre',
]);

const STATIC_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; connect-src 'none'; script-src 'none'";
const INTERACTIVE_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

function problem(code, message) {
  return { code, message };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sharedBans(html) {
  const errors = [];
  const rules = [
    [/javascript\s*:/i, 'js-url', '拒绝 javascript: 链接'],
    [/vbscript\s*:/i, 'js-url', '拒绝 vbscript: 链接'],
    [/data\s*:\s*text\/html/i, 'html-data-url', '拒绝 data:text/html'],
    [/\son[a-z]+\s*=/i, 'event-handler', '拒绝事件处理属性'],
    [/<\s*iframe\b/i, 'iframe', '附件里不能再嵌 iframe'],
    [/<\s*object\b/i, 'object', '拒绝 object'],
    [/<\s*embed\b/i, 'embed', '拒绝 embed'],
    [/<\s*link\b/i, 'external-link-tag', '拒绝 link 标签，样式请写在附件内部'],
    [/<\s*base\b/i, 'base', '拒绝 base 标签'],
    [/<\s*form\b/i, 'form', '拒绝表单'],
    [/<\s*svg\b/i, 'svg', '拒绝 SVG（可携带脚本）。图片请用正文 Figure'],
    [/srcdoc\s*=/i, 'srcdoc', '拒绝 srcdoc'],
    [/<\/iframe/i, 'iframe-close', '拒绝 iframe 结束标签'],
  ];
  for (const [pattern, code, message] of rules) {
    if (pattern.test(html)) errors.push(problem(code, message));
  }
  return errors;
}

function unquotedAttributes(html) {
  const errors = [];
  for (const tag of html.match(/<[a-zA-Z][^>]*>/g) ?? []) {
    const stripped = tag.replace(/=\s*"[^"]*"/g, '').replace(/=\s*'[^']*'/g, '');
    if (/=/.test(stripped)) errors.push(problem('unquoted-attr', `属性必须加引号：${tag.slice(0, 80)}`));
  }
  return errors;
}

function hrefProblems(html, { allowExternal }) {
  const errors = [];
  const warnings = [];
  for (const match of html.matchAll(/\bhref\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    const href = match[2] ?? match[3] ?? '';
    const verdict = classifyUrl(href);
    if (!verdict.ok) {
      errors.push(problem('bad-link', `附件链接不被接受（${verdict.reason}）：${href.slice(0, 120)}`));
    } else if (verdict.kind === 'external') {
      if (!allowExternal) errors.push(problem('remote-url', `附件不能引用外链：${href.slice(0, 120)}`));
      else warnings.push(problem('external-link', `外链未审，请人工确认：${href.slice(0, 120)}`));
    }
  }
  return { errors, warnings };
}

function wrapDocument(fragment, title, csp) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 2.2rem auto; max-width: 40rem; padding: 0 1.2rem; font-family: Georgia, "Songti SC", "Noto Serif SC", serif; font-size: 1.05rem; line-height: 1.65; color: #15161a; background: #fafaf6; }
  a { color: #7a1631; }
</style>
</head>
<body>
${fragment.trim()}
</body>
</html>
`;
}

function inspectStatic(html, label) {
  const errors = [...sharedBans(html), ...unquotedAttributes(html)];
  const warnings = [];
  if (/<\s*script\b/i.test(html)) {
    errors.push(problem('static-has-script', '说明性附件不能含脚本。交互页请把 kind 写成 interactive；脚本不会被悄悄删掉。'));
  }
  if (/<\s*(html|head|body|style|meta)\b/i.test(html)) {
    errors.push(problem('static-document', '说明性附件请给片段，不要给完整文档、style 或 meta。工具会套一层无脚本页面。'));
  }
  if (/\sstyle\s*=/i.test(html)) errors.push(problem('inline-style', '说明性附件不接受行内样式'));
  if (/https?:\/\//i.test(html)) errors.push(problem('remote-url', '说明性附件不接受 http(s) 资源。外链请写在正文里。'));
  const hrefs = hrefProblems(html, { allowExternal: false });
  errors.push(...hrefs.errors);
  const tags = html.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b/g) ?? [];
  for (const tag of tags) {
    const name = tag.replace(/<\/?/, '').toLowerCase();
    if (!STATIC_TAGS.has(name)) errors.push(problem('html-tag', `说明性附件不支持 <${name}>`));
  }
  if (errors.length) return { errors, warnings, changes: [], output: null };
  return {
    errors,
    warnings,
    changes: ['wrapped-static', 'injected-csp'],
    output: wrapDocument(html, label, STATIC_CSP),
  };
}

function inspectInteractive(html, label) {
  const errors = [...sharedBans(html), ...unquotedAttributes(html)];
  const warnings = [];
  if (!/<\s*script\b/i.test(html)) {
    errors.push(problem('not-interactive', '没有脚本的附件请使用 kind: static。工具不会把它当成交互实验。'));
  }
  if (/<\s*script\b[^>]*\bsrc\s*=/i.test(html)) {
    errors.push(problem('external-script', '交互附件只能使用内联脚本，不能引用 script src。'));
  }
  const network = [
    [/\bfetch\s*\(/, '出现了 fetch'],
    [/\bXMLHttpRequest\b/, '出现了 XMLHttpRequest'],
    [/\bWebSocket\b/, '出现了 WebSocket'],
    [/\bEventSource\b/, '出现了 EventSource'],
    [/\bsendBeacon\b/, '出现了 sendBeacon'],
    [/\b(localStorage|sessionStorage|indexedDB)\b/, '出现了站点存储 API'],
    [/\bdocument\.cookie\b/, '出现了 document.cookie'],
    [/\bserviceWorker\b/, '出现了 serviceWorker'],
    [/\b(parent|top|opener)\s*\./, '出现了访问外层页面的写法'],
    [/\bdocument\.domain\b/, '出现了 document.domain'],
    [/\bimport\s*\(/, '出现了动态 import'],
    [/https?:\/\//i, '出现了 http(s) 地址'],
  ];
  for (const [pattern, message] of network) {
    if (pattern.test(html)) errors.push(problem('interactive-escape', `${message}。沙盒不提供网络、存储或父页面。`));
  }
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const allowed = /charset\s*=/i.test(tag) || /name\s*=\s*["']viewport["']/i.test(tag);
    if (!allowed) errors.push(problem('meta-tag', `交互附件不接受这个 meta：${tag.slice(0, 100)}`));
  }
  if (/content-security-policy/i.test(html)) {
    errors.push(problem('author-csp', '请不要自带 CSP。工具会注入固定策略，不会和作者的策略合并。'));
  }
  const hrefs = hrefProblems(html, { allowExternal: false });
  errors.push(...hrefs.errors);
  if (errors.length) return { errors, warnings, changes: [], output: null };

  const meta = `<meta http-equiv="Content-Security-Policy" content="${INTERACTIVE_CSP}">`;
  let output = html;
  const changes = ['injected-csp'];
  if (/<head\b[^>]*>/i.test(html)) {
    output = html.replace(/<head\b[^>]*>/i, (open) => `${open}\n${meta}`);
  } else if (/<html\b[^>]*>/i.test(html)) {
    output = html.replace(/<html\b[^>]*>/i, (open) => `${open}\n<head>\n${meta}\n</head>`);
    changes.push('inserted-head');
  } else {
    output = wrapDocument(html, label, INTERACTIVE_CSP);
    changes.push('wrapped-interactive');
  }
  if (!output.includes('noindex')) {
    output = output.replace(/<head\b[^>]*>/i, (open) => `${open}\n<meta name="robots" content="noindex">`);
    changes.push('noindex');
  }
  return { errors, warnings, changes, output: output.endsWith('\n') ? output : `${output}\n` };
}

export function inspectAttachment(kind, html, label) {
  if (html.includes('\0')) {
    return { errors: [problem('binary-html', 'HTML 附件含空字节')], warnings: [], changes: [], output: null };
  }
  if (kind === 'static') return inspectStatic(html, label);
  if (kind === 'interactive') return inspectInteractive(html, label);
  return {
    errors: [problem('attachment-kind', `不支持的附件类型 ${kind}。只接受 static 或 interactive。`)],
    warnings: [],
    changes: [],
    output: null,
  };
}
