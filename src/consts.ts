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
  // 对外联系邮箱：专门注册用于公开场合，与个人邮箱隔离。
  // 个人邮箱不出现在站点的任何位置，也不要写进注释或提交信息。
  email: 'fiercemanmax@outlook.com',
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
  {
    slug: 'gezhi',
    title: '格致',
    subtitle: 'Investigation of Things',
    tagline: 'First principles, classics, and the patterns that only show up after years in the field.',
    taglineZh: '第一性原理、经典，以及只有在事上磨练之后才会显影的那些规律。',
    keywords: ['心学', '致良知', '第一性原理', '省思'],
  },
  {
    slug: 'llm',
    title: 'LLM',
    subtitle: 'From Scratch',
    tagline: 'From tokenization and training to inference, building a language model from scratch.',
    taglineZh: '从分词、训练到推理，把一个语言模型从头搭起来。',
    keywords: ['tokenizer', 'Transformer', 'training', 'inference', 'attention'],
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

// 把标签名转成 URL 友好的 slug：小写 + 空格换连字符。
// 拉丁字母仍会收成 "Signal Integrity" → "signal-integrity"。
// 中文标签原样保留，否则会被滤成空路径，标签页构建失败。
export function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[\s/]+/g, '-')
    .replace(/[^\p{L}\p{N}\-]/gu, '');
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
