import { CATEGORIES } from '~/consts';
import type { Locale } from './routing';

const ZH_SUBTITLE: Record<string, string> = {
  hsd: '高速数字',
  eoe: '光电链路',
  siph: '硅光器件',
  pi: '电源完整性',
  gezhi: '观察与思辨',
  llm: '从头搭建',
};

const GEZHI_KEYWORDS_EN = ['AI Agent', 'Human-AI', 'Engineering', 'First Principles'];

export function categoryView(cat: (typeof CATEGORIES)[number], locale: Locale) {
  return {
    title: cat.title,
    subtitle: locale === 'zh' ? (ZH_SUBTITLE[cat.slug] ?? cat.subtitle) : cat.subtitle,
    tagline: locale === 'zh' ? cat.taglineZh : cat.tagline,
    keywords: (locale === 'en' && cat.slug === 'gezhi' ? GEZHI_KEYWORDS_EN : cat.keywords) as readonly string[],
  };
}

export function entryLabel(n: number, locale: Locale): string {
  if (locale === 'zh') return `${n} 篇`;
  return `${n} ${n === 1 ? 'entry' : 'entries'}`;
}

export function readTime(minutes: number, locale: Locale): string {
  if (locale === 'zh') return `${minutes} 分钟阅读`;
  return `${minutes} min read`;
}

const editorialWords = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

export function editorialCount(n: number, locale: Locale): string {
  if (locale === 'zh') return `${n} 条编辑线`;
  const word = editorialWords[n] ?? String(n);
  return `${word} editorial ${n === 1 ? 'line' : 'lines'}`;
}

export const ui = {
  zh: {
    htmlLang: 'zh-CN',
    ogLocale: 'zh_CN',
    metaDescription: '个人技术博客 —— 信号完整性 / 硅光器件与链路 / EDA 自动化与笔记。',
    navAria: '主导航',
    homeAria: '返回首页',
    themeLabel: '切换明暗模式',
    langLabel: '切换到英文',
    footerAria: '次要链接',
    contact: '联系',
    colophon: '后记',
    typeset: '字体为 Fraunces 与 Inter。使用 Astro 构建，部署在 GitHub Pages。',
    rights: '保留所有权利',
    journalName: 'Fierceman 日志',
    nav: [
      { label: '写作', href: '/posts/' },
      { label: '栏目', href: '/categories/' },
      { label: '标签', href: '/tags/' },
      { label: '关于', href: '/about/' },
      { label: 'RSS', href: '/rss.xml' },
    ],
    home: {
      sections: '栏目',
      recent: '近期写作',
      archive: '浏览全部文章',
      empty: '还没有文章。',
    },
    writing: {
      title: '写作',
      kicker: '档案',
      description: '所有文章档案 —— 按年份归档。',
      lead: '按时间排列的随笔、笔记和短报告。多数是技术，也有不是的。',
      empty: '还没有文章。',
    },
    sections: {
      title: '栏目',
      kicker: '栏目',
      description: '按栏目浏览：HSD 高速数字、EOE 光电链路、SiPh 硅光器件、PI 电源完整性、AI随想、LLM 从头搭建。',
      lead: '一份日志，六条编辑线。挑今天离你的工作最近的那一条。',
      misc: (n: number) => `另有 ${n} 篇未归入栏目的笔记 ——`,
      browse: '浏览全部文章 →',
    },
    category: {
      kicker: '栏目',
      emptyBefore: '这个栏目还没有文章。',
      emptyLink: '回到首页。',
    },
    tags: {
      title: '标签',
      kicker: '主题',
      description: '按标签浏览全部文章。',
      lead: '一组非正式的主题。上标是篇数。',
      count: (n: number) => `${n} 个标签`,
      empty: '还没有标签。',
    },
    tag: {
      kicker: '标签',
      description: (name: string) => `所有标签为 ${name} 的文章。`,
      lead: '与这个主题有关的文章，新的在前。',
    },
    post: {
      tagsAria: '标签',
      revised: '修订于',
      older: '← 更早',
      newer: '较新 →',
      navAria: '文章导航',
      original: '原文',
      feature: '本期',
      essay: '随笔',
      readFull: '阅读全文',
      published: '发布',
      lastRevised: '最近修订',
      reading: '阅读',
      filed: '归档',
      readOn: '继续阅读',
    },
    notFound: {
      title: '404 — 页面不存在',
      description: '页面不存在',
      kicker: 'Error · 404',
      leadBefore: '链接断了，或者文章被移走了。要不回到',
      home: '首页',
      mid: '看看？或者浏览',
      writing: '所有文章',
      after: '。',
    },
    comments: {
      aria: '留言',
      label: '留言',
      note: '不用注册任何账号，填个昵称就能留言。留言会直接到我这里，我看到了会回。',
      name: '昵称',
      namePh: '随便写一个',
      reply: '回信地址',
      replyOpt: '（选填，方便我回你）',
      message: '留言',
      messagePh: '哪一段看不懂、哪里跑不通、或者你那边实测结果不一样……',
      send: '发送',
      sending: '发送中…',
      errName: '写个昵称吧。',
      errShort: '内容太短了，多写两句。',
      ok: '已收到，谢谢。我会看的。',
      errActivation: '通道正在激活，稍后再试。',
      errSend: '没发出去，稍后再试。',
      errNet: '网络没通，重试一次。',
      subject: (name: string) => `[FIERCEMAN · JOURNAL] 留言来自 ${name}`,
    },
  },
  en: {
    htmlLang: 'en',
    ogLocale: 'en_US',
    metaDescription:
      'A personal journal of signal integrity, silicon photonics, and the details that make EDA work.',
    navAria: 'Primary',
    homeAria: 'Back to home',
    themeLabel: 'Toggle color theme',
    langLabel: 'Switch to Chinese',
    footerAria: 'Secondary',
    contact: 'Contact',
    colophon: 'Colophon',
    typeset: 'Typeset in Fraunces & Inter. Built with Astro, deployed on GitHub Pages.',
    rights: 'All rights reserved.',
    journalName: 'The Fierceman Journal',
    nav: [
      { label: 'Writing', href: '/posts/' },
      { label: 'Sections', href: '/categories/' },
      { label: 'Tags', href: '/tags/' },
      { label: 'About', href: '/about/' },
      { label: 'RSS', href: '/rss.xml' },
    ],
    home: {
      sections: 'The Sections',
      recent: 'Recent Writing',
      archive: 'Browse the full archive',
      empty: 'No entries yet. Stay tuned.',
    },
    writing: {
      title: 'Writing',
      kicker: 'The Archive',
      description: 'Every entry, filed by year.',
      lead: 'A chronological record of essays, notes, and small reports. Most pieces are technical; some are not.',
      empty: 'No entries yet.',
    },
    sections: {
      title: 'Sections',
      kicker: 'The Sections',
      description:
        'Browse by section: HSD, EOE, silicon photonics, power integrity, AI Reflections, and LLM.',
      lead: 'Six editorial lines, one journal. Pick whichever is closest to your work today.',
      misc: (n: number) => `Plus ${n} miscellaneous ${n === 1 ? 'note' : 'notes'} —`,
      browse: 'browse the full archive →',
    },
    category: {
      kicker: 'Section',
      emptyBefore: 'Nothing under this section yet. Stay tuned —',
      emptyLink: 'back to home.',
    },
    tags: {
      title: 'Tags',
      kicker: 'Topics',
      description: 'Every entry, gathered by tag.',
      lead: 'An informal taxonomy of recurring topics. Counts in superscript.',
      count: (n: number) => `${n} ${n === 1 ? 'tag' : 'tags'}`,
      empty: 'No tags yet.',
    },
    tag: {
      kicker: 'Tag',
      description: (name: string) => `Entries tagged ${name}.`,
      lead: 'Pieces touching on this topic, newest first.',
    },
    post: {
      tagsAria: 'Tags',
      revised: 'Revised',
      older: '← Older',
      newer: 'Newer →',
      navAria: 'More writing',
      original: 'Original',
      feature: 'Feature',
      essay: 'Essay',
      readFull: 'Read the full piece',
      published: 'Published',
      lastRevised: 'Last revised',
      reading: 'Reading',
      filed: 'Filed under',
      readOn: 'Read on',
    },
    notFound: {
      title: '404 — Not Found',
      description: 'This page does not exist.',
      kicker: 'Error · 404',
      leadBefore: 'The link is broken, or the piece has moved. Try the ',
      home: 'home page',
      mid: ', or browse ',
      writing: 'the archive',
      after: '.',
    },
    comments: {
      aria: 'Notes',
      label: 'Leave a note',
      note: 'No account. A name is enough. The note comes straight to me, and I reply when I see it.',
      name: 'Name',
      namePh: 'Any name',
      reply: 'Reply address',
      replyOpt: '(optional, so I can write back)',
      message: 'Note',
      messagePh: 'A passage that lost you, a step that will not run, or a measurement that disagrees…',
      send: 'Send',
      sending: 'Sending…',
      errName: 'A name, please.',
      errShort: 'A little short. Say a bit more.',
      ok: 'Received. Thank you — I will read it.',
      errActivation: 'The channel is still activating. Try again later.',
      errSend: 'It did not go out. Try again later.',
      errNet: 'The network did not connect. Retry.',
      subject: (name: string) => `[FIERCEMAN · JOURNAL] Note from ${name}`,
    },
  },
} as const;

export type UI = (typeof ui)[Locale];

export function useUI(locale: Locale): UI {
  return ui[locale];
}
