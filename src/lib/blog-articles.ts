import { getCollection } from 'astro:content';

export async function getBlogArticles() {
  const [published, archive] = await Promise.all([
    getCollection('published'),
    getCollection('archive'),
  ]);
  const originals = new Map(archive.map((article) => [article.id, article]));
  const current = new Set(published.map((article) => article.id));
  return [
    ...published.map((article) => ({
      article,
      noindex: article.data.index === false || originals.get(article.id)?.data.index === false,
      sharedFont: false,
    })),
    ...archive
      .filter((article) => !current.has(article.id))
      .map((article) => ({
        article,
        noindex: article.data.index === false,
        sharedFont: true,
      })),
  ];
}
