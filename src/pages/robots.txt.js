import { pathFor } from '../lib/published.mjs';

export function GET({ site }) {
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${new URL(pathFor('/sitemap.xml'), site).href}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
