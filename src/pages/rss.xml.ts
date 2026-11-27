import { getBlogArticles } from '../lib/blog-articles';
import { articlePath, siteDescription, siteName, siteUrl } from '../lib/site';
import { xmlResponse, xmlText } from '../lib/xml';

export async function GET() {
  const articles = (await getBlogArticles())
    .map(({ article }) => article)
    .toSorted((a, b) => Date.parse(b.data.publishedAt) - Date.parse(a.data.publishedAt));
  const items = articles.map(({ id, data }) => {
    const url = xmlText(siteUrl(articlePath(id)));
    return `    <item>
      <title>${xmlText(data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="false">${url}</guid>
      <pubDate>${new Date(data.publishedAt).toUTCString()}</pubDate>
      <description>${xmlText(data.summary ?? '')}</description>
    </item>`;
  });
  const newest = articles.at(0);
  const lastBuildDate = newest
    ? `    <lastBuildDate>${new Date(newest.data.publishedAt).toUTCString()}</lastBuildDate>\n`
    : '';
  return xmlResponse(`<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlText(siteName)}</title>
    <link>${siteUrl('blog/')}</link>
    <description>${xmlText(siteDescription)}</description>
${lastBuildDate}    <language>ja</language>
    <copyright>${xmlText(siteName)}</copyright>
    <atom:link href="${siteUrl('rss.xml')}" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>`);
}
