import { posts, postPath, pathFor } from '../lib/published.mjs';
import { xmlEscape } from '../../lib/posts.mjs';

export function GET({ site }) {
  const absolute = (path) => new URL(path, site).href;
  const items = posts.map((post) => `<item><title>${xmlEscape(post.title)}</title><link>${xmlEscape(absolute(postPath(post.slug)))}</link><guid isPermaLink="true">${xmlEscape(absolute(postPath(post.slug)))}</guid><description>${xmlEscape(post.summary)}</description><pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate></item>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>ジブンノート</title><link>${xmlEscape(absolute(pathFor('/blog/')))}</link><description>silverbirderのブログ</description><language>ja</language>${items}</channel></rss>`, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
