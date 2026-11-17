import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from '~/i18n/routing';

export type JournalPost = CollectionEntry<'posts'> | CollectionEntry<'postsEn'>;

export async function loadPosts(locale: Locale): Promise<JournalPost[]> {
  const posts =
    locale === 'en'
      ? await getCollection('postsEn', ({ data }) => !data.draft)
      : await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}
