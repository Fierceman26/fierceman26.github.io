// 语言路由。中文是默认语言，URL 不带前缀；英文一律在 /en/ 下。
// 页面上的切换链接和 <head> 里的首次访问跳转都走同一套规则。

export const LOCALES = ['zh', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_STORAGE_KEY = 'locale-preference';

// 格致一文的中文标签与英文标签 slug 不同，切换时要对上同一篇文章的标签页。
// 键和值都是 decode 之后的 slug，不是百分号编码。
export const TAG_SLUG_ALT: Record<string, string> = {
  王阳明: 'wang-yangming',
  致良知: 'liangzhi',
  心学: 'school-of-mind',
  第一性原理: 'first-principles',
  'wang-yangming': '王阳明',
  liangzhi: '致良知',
  'school-of-mind': '心学',
  'first-principles': '第一性原理',
};

export function decodePath(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

export function localeFromPath(pathname: string): Locale {
  const path = decodePath(pathname || '/');
  if (path === '/en' || path.startsWith('/en/')) return 'en';
  return 'zh';
}

export function useLocale(current: string | undefined, pathname: string): Locale {
  if (current === 'en' || current === 'zh') return current;
  return localeFromPath(pathname);
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'zh' ? 'en' : 'zh';
}

/** 去掉 /en 前缀，得到两种语言共用的路径。 */
export function stripLocale(pathname: string): string {
  const path = decodePath(pathname || '/');
  if (path === '/en' || path === '/en/') return '/';
  if (path.startsWith('/en/')) {
    const rest = path.slice(3);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return path || '/';
}

function ensureSlash(path: string): string {
  if (path === '/' || path === '') return '/';
  if (/\.[a-z0-9]+$/i.test(path)) return path;
  return path.endsWith('/') ? path : `${path}/`;
}

/** path 必须是不带语言前缀的站内路径。 */
export function localizePath(path: string, locale: Locale): string {
  const bare = ensureSlash(path.startsWith('/') ? path : `/${path}`);
  if (locale === 'zh') return bare;
  if (bare === '/') return '/en/';
  return `/en${bare}`;
}

/** 标签 slug 换成目标语言那一侧。对照表是双向的，已经在目标语言上的 slug 保持不动。 */
export function tagSlugFor(slug: string, target: Locale): string {
  const mapped = TAG_SLUG_ALT[slug];
  if (!mapped) return slug;
  const mappedIsZh = /[^\u0000-\u007f]/.test(mapped);
  if (target === 'zh') return mappedIsZh ? mapped : slug;
  return mappedIsZh ? slug : mapped;
}

/** 当前 URL 在目标语言下的对应地址。 */
export function alternatePath(pathname: string, target: Locale): string {
  let bare = stripLocale(pathname);
  const tag = bare.match(/^\/tags\/([^/]+)\/?$/);
  if (tag) bare = `/tags/${tagSlugFor(tag[1], target)}/`;
  return localizePath(bare, target);
}
