// 全站常量，改这里就能改站名 / 副标题 / 作者等
// 部署到 GitHub Pages 时 SITE 同步改成自己的地址

export const SITE = {
  title: 'FIERCEMAN · JOURNAL',
  shortTitle: 'FIERCEMAN',
  // 副标题用衬线斜体在 hero 区展示
  tagline: 'Notes on signal integrity, silicon photonics, and the small details that make EDA work.',
  // 中文副标题，鼠标 hover 显示
  taglineZh: '关于信号完整性、硅光设计，以及让 EDA 真正跑起来的那些细节。',
  description: '个人技术博客 —— 信号完整性 / 硅光器件与链路 / EDA 自动化与笔记。',
  author: 'Fierceman',
  // 刻意不放邮箱：站点是公开的，任何明文地址都会被爬虫抓走并发垃圾邮件。
  // 联系方式统一走每篇文章底部的匿名留言框（不含任何个人信息）。
  // 顶部 issue 编号：杂志感装饰，每次构建按当前日期生成
  // 你也可以手动改成固定值
  locale: 'zh-CN',
} as const;

export const NAV = [
  { label: 'Writing', href: '/posts/' },
  { label: 'Sections', href: '/categories/' },
  { label: 'Tags', href: '/tags/' },
  { label: 'About', href: '/about/' },
  { label: 'RSS', href: '/rss.xml' },
] as const;

// 固定栏目（杂志的"Section"概念）—— 在首页栏目卡片和分类页都用这套元数据
// 新增一个分类：直接在这个数组里加一项，并在文章 frontmatter 的 category 字段里用 slug
// slug 用于 URL（/categories/<slug>/）和 frontmatter 的 category 字段值
export const CATEGORIES = [
  {
    slug: 'hsd',
    title: 'HSD',
    subtitle: 'High-Speed Digital',
    tagline: 'Channel design, signal integrity, and the millivolts that decide if your link closes.',
    taglineZh: '通道设计、信号完整性，以及决定链路开不开眼的那几毫伏。',
    keywords: ['SI', 'DDR', 'PCIe', 'channel', 'skew', 'eye'],
  },
  {
    slug: 'eoe',
    title: 'EOE',
    subtitle: 'Electro-Optical-Electrical Link',
    tagline: 'Modulators, photodetectors, and the systems that stitch electrons to photons and back.',
    taglineZh: '调制器、探测器，以及把电子和光子缝合在一起的系统级链路。',
    keywords: ['MZM', 'TIA', 'optical', 'link budget', 'photonics'],
  },
  // 器件级（条形波导、耦合器）放 siph。EOE 仍是系统级链路，不要把波导车间写进 eoe。
  {
    slug: 'siph',
    title: 'SiPh',
    subtitle: 'Silicon Photonics',
    tagline: 'Strip waveguides, couplers, and the device-level work that feeds an optical link.',
    taglineZh: '条形波导、耦合器，以及支撑光链路的器件级设计。',
    keywords: ['SOI', 'MODE', 'waveguide', 'FDE', 'PIC'],
  },
  {
    slug: 'pi',
    title: 'PI',
    subtitle: 'Power Integrity',
    tagline: 'PDN, target impedance, and what happens when the rail moves before the data does.',
    taglineZh: 'PDN、目标阻抗，以及电压在数据之前先抖的那些时刻。',
    keywords: ['PDN', 'IR drop', 'decoupling', 'target Z', 'rail'],
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];

export function findCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}

// 把 ISO 日期格式化成 "2026 · 05 · 20" 这样的杂志风
export function magazineDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y} · ${m} · ${day}`;
}

// 把标签名转成 URL 友好的 slug：小写 + 空格换连字符
// 例如 "Signal Integrity" → "signal-integrity"
export function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[\s/]+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
}

// "Vol. III · No. 7" 风格的卷期号 —— 根据日期推算
export function issueLabel(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const volIdx = Math.max(0, year - 2026); // 第一年为 Vol. I
  const vol = roman[volIdx] ?? String(volIdx + 1);
  return `Vol. ${vol} · No. ${String(month).padStart(2, '0')}`;
}
