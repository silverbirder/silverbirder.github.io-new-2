import { getCollection } from 'astro:content';

export async function getBlogArticles() {
  const articles = await getCollection('published');
  return articles.map((article) => ({
    article,
    noindex: article.data.index === false,
    sharedFont: true,
  }));
}
