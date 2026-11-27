import { siteDescription, siteName } from '../lib/site';

export function GET() {
  const base = import.meta.env.BASE_URL;
  const iconSizes = [32, 48, 72, 96, 144, 192, 512];
  return new Response(
    JSON.stringify({
      name: siteName,
      short_name: 'ノート',
      description: siteDescription,
      display: 'standalone',
      start_url: base,
      scope: base,
      background_color: '#f4f4f5',
      theme_color: '#116932',
      icons: iconSizes.map((size) => ({
        src: `${base}icon/${size}`,
        sizes: `${size}x${size}`,
        type: 'image/png',
      })),
    }),
    { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' } },
  );
}
