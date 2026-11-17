import rss from '@astrojs/rss';
import { SITE } from '~/consts';
import { ui } from '~/i18n/ui';
import { loadPosts } from '~/lib/posts';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await loadPosts('zh');

  return rss({
    title: SITE.title,
    description: ui.zh.metaDescription,
    site: context.site ?? 'https://example.github.io',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/posts/${post.id}/`,
      categories: post.data.tags,
    })),
    customData: `<language>${SITE.locale}</language>`,
  });
}
