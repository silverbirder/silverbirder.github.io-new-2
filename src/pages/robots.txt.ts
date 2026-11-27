import { siteUrl } from '../lib/site';

export function GET() {
  const rootBuild = import.meta.env.BASE_URL === '/';
  const rules = rootBuild
    ? `Allow: /\n\nHost: ${new URL(siteUrl()).origin}\nSitemap: ${siteUrl('sitemap.xml')}`
    : `Disallow: ${import.meta.env.BASE_URL}`;
  return new Response(`User-Agent: *\n${rules}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
