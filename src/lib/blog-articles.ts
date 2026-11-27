import { Buffer } from 'node:buffer';
import { getCollection } from 'astro:content';
import { articleSlug } from './article-slug';

export async function getBlogArticles() {
  const articles = await getCollection('published');
  return articles.map((article) => ({
    article,
    noindex: article.data.index === false,
    sharedFont: true,
  }));
}

export async function getBlogArchive() {
  const base = import.meta.env.BASE_URL;
  return (await getBlogArticles())
    .map(({ article }) => ({
      url: `${base}blog/contents/${articleSlug(article.id)}/`,
      title: article.data.title,
      publishedAt: article.data.publishedAt,
      tags: articleTags(article.data.tags),
    }))
    .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export type BlogArchiveEntry = Awaited<ReturnType<typeof getBlogArchive>>[number];

export async function getTaggedBlogArchive() {
  const tagged = new Map<string, BlogArchiveEntry[]>();
  for (const entry of await getBlogArchive()) {
    for (const tag of entry.tags) {
      let entries = tagged.get(tag);
      if (!entries) {
        entries = [];
        tagged.set(tag, entries);
      }
      entries.push(entry);
    }
  }
  return tagged;
}

export function articleTags(tags?: readonly string[] | null) {
  return [...new Set(tags?.map((tag) => tag.trim()).filter(Boolean))];
}

export function blogTagSlug(tag: string) {
  // 区切り文字や大文字を含むタグも、個別のパスに割り当てる。
  if (/^[\p{L}\p{N}_-]+$/u.test(tag) && tag === tag.toLowerCase().normalize('NFC')) {
    return tag;
  }
  return '~' + Buffer.from(tag).toString('hex');
}

export function blogTagHref(tag: string) {
  return `${import.meta.env.BASE_URL}blog/tags/${encodeURIComponent(blogTagSlug(tag))}/`;
}
