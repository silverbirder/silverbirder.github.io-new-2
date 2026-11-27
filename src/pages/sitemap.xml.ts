import { getBlogArticles } from '../lib/blog-articles';
import { articlePath, siteUrl } from '../lib/site';
import { xmlResponse, xmlText } from '../lib/xml';

export async function GET() {
  const articles = await getBlogArticles();
  const paths = ['', 'me/', 'blog/', ...articles.map(({ article }) => articlePath(article.id))];
  const entries = paths.map((path) => `  <url><loc>${xmlText(siteUrl(path))}</loc></url>`);
  return xmlResponse(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`);
}
