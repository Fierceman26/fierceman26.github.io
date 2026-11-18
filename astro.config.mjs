import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { journalPwa } from './src/pwa/integration.mjs';
import { rehypeImageMark } from './src/lib/rehype-image-mark.mjs';

// <Figure /> in MDX posts, without a per-file import.
// The MDX compiler only uses a component that is already in scope; otherwise
// it looks for props.components.Figure and fails the build. This plugin
// injects the import before that compiler runs.
function mdxFigureComponents() {
  // MDX only resolves a component that is already in scope. Inject the import
  // when a post uses the tag, so notes don't repeat the same import block.
  const widgets = [
    { tag: '<Figure', marker: 'components/Figure.astro', line: "import Figure from '~/components/Figure.astro';\n" },
    { tag: '<SlabLimit', marker: 'components/siph/SlabLimit.astro', line: "import SlabLimit from '~/components/siph/SlabLimit.astro';\n" },
    { tag: '<NeffWindow', marker: 'components/siph/NeffWindow.astro', line: "import NeffWindow from '~/components/siph/NeffWindow.astro';\n" },
    { tag: '<ModePortrait', marker: 'components/siph/ModePortrait.astro', line: "import ModePortrait from '~/components/siph/ModePortrait.astro';\n" },
    { tag: '<ModeTravel', marker: 'components/siph/ModeTravel.astro', line: "import ModeTravel from '~/components/siph/ModeTravel.astro';\n" },
    { tag: '<CpoReach', marker: 'components/siph/CpoReach.astro', line: "import CpoReach from '~/components/siph/CpoReach.astro';\n" },
    { tag: '<CpoEls', marker: 'components/siph/CpoEls.astro', line: "import CpoEls from '~/components/siph/CpoEls.astro';\n" },
    { tag: '<CpoMod', marker: 'components/siph/CpoMod.astro', line: "import CpoMod from '~/components/siph/CpoMod.astro';\n" },
    { tag: '<CpoLoop', marker: 'components/siph/CpoLoop.astro', line: "import CpoLoop from '~/components/siph/CpoLoop.astro';\n" },
    { tag: '<SolverPick', marker: 'components/siph/SolverPick.astro', line: "import SolverPick from '~/components/siph/SolverPick.astro';\n" },
    { tag: '<BendLossPick', marker: 'components/siph/BendLossPick.astro', line: "import BendLossPick from '~/components/siph/BendLossPick.astro';\n" },
    { tag: '<CouplerPick', marker: 'components/siph/CouplerPick.astro', line: "import CouplerPick from '~/components/siph/CouplerPick.astro';\n" },
    { tag: '<YCombine', marker: 'components/siph/YCombine.astro', line: "import YCombine from '~/components/siph/YCombine.astro';\n" },
    { tag: '<YBranchPick', marker: 'components/siph/YBranchPick.astro', line: "import YBranchPick from '~/components/siph/YBranchPick.astro';\n" },
  ];
  return {
    name: 'mdx-figure-components',
    hooks: {
      'astro:config:setup'({ updateConfig }) {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'inject-mdx-figure',
                enforce: 'pre',
                transform(code, id) {
                  const path = id.split('?')[0];
                  if (!path.endsWith('.mdx')) return;
                  const needed = widgets.filter((item) => code.includes(item.tag) && !code.includes(item.marker));
                  if (needed.length === 0) return;
                  const block = needed.map((item) => item.line).join('');
                  const fence = code.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
                  if (fence) {
                    const at = fence[0].length;
                    return code.slice(0, at) + block + code.slice(at);
                  }
                  return block + code;
                },
              },
            ],
          },
        });
      },
    },
  };
}

// 站点 URL：部署到 GitHub Pages 时改成自己的域名 / 用户名.github.io
// 自定义域名场景：site 改成 https://your-domain.tld，base 保持 '/'。
// 仓库名子路径场景（user.github.io/repo）：site 保持 user.github.io，base 改成 '/repo/'。
export default defineConfig({
  site: 'https://fierceman26.github.io',
  base: '/',
  trailingSlash: 'ignore',
  // 中文是默认语言，URL 不带前缀。英文页面放在 src/pages/en/，公开路径为 /en/。
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [
    mdxFigureComponents(),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'zh',
        locales: {
          zh: 'zh-CN',
          en: 'en-US',
        },
      },
    }),
    journalPwa(),
  ],
  markdown: {
    rehypePlugins: [rehypeImageMark],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark-dimmed',
      },
      wrap: true,
    },
  },
  build: {
    format: 'directory',
  },
});
