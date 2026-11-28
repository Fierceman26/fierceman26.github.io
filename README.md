# Fierceman · Journal

个人技术博客 —— 信号完整性、硅光器件与链路、EDA 自动化笔记。

基于 [Astro](https://astro.build) + MDX 搭建，部署在 GitHub Pages。
设计语言：现代杂志风（serif headlines + sans-serif metadata + Bordeaux accent）。

## 本地开发

```bash
# 安装依赖（一次性）
npm install

# 开发服务器（http://localhost:4321）
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview
```

## 写一篇新文章

1. 在 `src/content/posts/` 下新建一个 `.mdx` 文件（文件名就是 URL slug）
2. 复制下面的 frontmatter 模板：

```mdx
---
title: "文章标题（中英文都可）"
description: "一句话摘要，列表页和首页会用。"
pubDate: 2026-05-20
# updatedDate: 2026-05-22       # 可选：修订日期
tags: ["ADS", "SIPro"]            # 可选：标签数组
category: "hsd"                   # 可选：hsd / eoe / siph / pi / gezhi / llm / ai-hardware
featured: false                   # true 时置顶为首页 hero
draft: false                      # true 时构建不出现
---

正文用 Markdown / MDX 写。可以嵌 React/Vue 组件，可以贴代码块。
```

3. `npm run dev` 实时预览
4. 满意后提交 push，GitHub Actions 会自动构建部署

机械的导入和校验可以用发布工具，不必把正文贴进对话。约定见 `scripts/publish/STYLE.md`，空模板在 `scripts/publish/templates/`。

```bash
node scripts/publish/cli.mjs --input <稿件目录> --dry-run
node scripts/publish/cli.mjs --input <稿件目录>
```

脚本不翻译、不改观点、不补公式。默认只在本地准备文件，不提交、不推送。

## 目录结构

```
src/
├── content/
│   ├── config.ts          # 文章 collection schema
│   └── posts/             # 所有文章 .mdx 放这里
├── components/            # 可复用 UI 组件
├── layouts/               # 页面骨架
├── pages/                 # 路由（文件即路由）
├── styles/global.css      # 全站样式（设计 tokens、字体、暗色模式）
└── consts.ts              # 站名、副标题、导航、作者信息

public/                    # 静态资源（favicon、图片等）
.github/workflows/         # GitHub Actions 部署 workflow
astro.config.mjs           # Astro 配置（site URL、integrations）
```

## 部署到 GitHub Pages

**步骤一：准备仓库**

把整个目录初始化为 Git 仓库，push 到 GitHub。
推荐仓库名：

- `<username>.github.io` —— 部署在根域名（`https://<username>.github.io/`）
- 或任意名字 —— 部署在子路径（`https://<username>.github.io/<repo>/`）

**步骤二：改 `astro.config.mjs`**

```js
// 根域名情况：
export default defineConfig({
  site: 'https://<username>.github.io',
  base: '/',
  // ...
});

// 子路径情况：
export default defineConfig({
  site: 'https://<username>.github.io',
  base: '/<repo>/',
  // ...
});

// 自定义域名情况：
export default defineConfig({
  site: 'https://your-domain.com',
  base: '/',
  // ...
});
```

**步骤三：启用 GitHub Pages**

仓库 → Settings → Pages → Source 选 **GitHub Actions**。

接下来每次 push 到 `main`，`.github/workflows/deploy.yml` 都会跑构建、自动上线。

## 设计 tokens

如果想调主色 / 字体 / 间距，集中在 `src/styles/global.css` 文件顶部的 `:root { ... }` 里：

| Token | 默认值 | 说明 |
| --- | --- | --- |
| `--bg` | `#fafaf6` | 主背景（暖米白） |
| `--ink` | `#15161a` | 主文字（近黑） |
| `--accent` | `#7a1631` | 唯一强调色（Bordeaux） |
| `--font-serif` | Fraunces | 标题 + 正文衬线 |
| `--font-sans` | Inter | 元数据 + UI |
| `--font-mono` | JetBrains Mono | 代码 |

暗色模式定义在 `:root[data-theme='dark']` 和 `@media (prefers-color-scheme: dark)` 两处。

## 写作建议

- 一篇好的笔记 > 三篇水文。这个站点的设计语言鼓励**少而精**。
- 标题用 6-12 字最舒服（serif 大字排版会用 18ch max-width）。
- `description` 字段是首页和列表页的引导句，多花点心思。
- `category` 用栏目 slug：`hsd` / `eoe` / `siph` / `pi` / `gezhi` / `llm` / `ai-hardware`。它会变成 `/categories/<slug>/`，不要写成 "Signal Integrity" 这种展示名。波导、耦合器归 `siph`；MZM、TIA、链路 budget 仍归 `eoe`。AI随想与第一性原理归 `gezhi`。从头搭建语言模型归 `llm`。智能感知与端侧 AI 硬件归 `ai-hardware`。
- `tags` 用细分关键词（"SIPro" / "DDR5" / "Python API"）。
