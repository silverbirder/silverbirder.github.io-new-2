import { posts, postPath, pathFor } from '../lib/published.mjs';
import { xmlEscape } from '../../lib/posts.mjs';

export function GET({ site }) {
  const paths = [pathFor('/'), pathFor('/blog/'), ...posts.map((post) => postPath(post.slug))];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${xmlEscape(new URL(path, site).href)}</loc></url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
