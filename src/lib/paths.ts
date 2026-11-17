import { CATEGORIES, slugifyTag } from '~/consts';
import type { Locale } from '~/i18n/routing';
import { loadPosts, type JournalPost } from './posts';

export async function categoryStaticPaths(locale: Locale) {
  const all = await loadPosts(locale);
  return CATEGORIES.map((category) => ({
    params: { category: category.slug },
    props: {
      category,
      posts: all.filter((post) => post.data.category === category.slug),
    },
  }));
}

export async function tagStaticPaths(locale: Locale) {
  const all = await loadPosts(locale);
  const groups = new Map<string, JournalPost[]>();
  for (const post of all) {
    for (const tag of post.data.tags) {
      const list = groups.get(tag);
      if (list) list.push(post);
      else groups.set(tag, [post]);
    }
  }
  return [...groups.entries()].map(([tagName, posts]) => ({
    params: { tag: slugifyTag(tagName) },
    props: { tagName, posts },
  }));
}
