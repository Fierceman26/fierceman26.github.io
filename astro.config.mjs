import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// 站点 URL：部署到 GitHub Pages 时改成自己的域名 / 用户名.github.io
// 自定义域名场景：site 改成 https://your-domain.tld，base 保持 '/'。
// 仓库名子路径场景（user.github.io/repo）：site 保持 user.github.io，base 改成 '/repo/'。
export default defineConfig({
  site: 'https://fierceman26.github.io',
  base: '/',
  trailingSlash: 'ignore',
  integrations: [
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
