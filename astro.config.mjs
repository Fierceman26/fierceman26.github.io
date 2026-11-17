import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// <Figure /> in MDX posts, without a per-file import.
// The MDX compiler only uses a component that is already in scope; otherwise
// it looks for props.components.Figure and fails the build. This plugin
// injects the import before that compiler runs.
function mdxFigureComponents() {
  const importLine = "import Figure from '~/components/Figure.astro';\n";
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
                  if (!id.endsWith('.mdx')) return;
                  if (!code.includes('<Figure')) return;
                  if (code.includes('components/Figure.astro')) return;
                  const fence = code.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
                  if (fence) {
                    const at = fence[0].length;
                    return code.slice(0, at) + importLine + code.slice(at);
                  }
                  return importLine + code;
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
  integrations: [
    mdxFigureComponents(),
    mdx(),
    sitemap(),
  ],
  markdown: {
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
