import { copyFile, mkdir } from 'node:fs/promises';
import { copyPublishedArticles, removeStaleArticles } from './cms-github.mjs';

const cache = new URL('../.cache/', import.meta.url);
const directory = new URL('cms-published/', cache);
await mkdir(directory, { recursive: true });

const token = process.env.CMS_PUBLISHED_READ_TOKEN;
if (token) {
  await copyPublishedArticles(cache, directory, token);
} else {
  if (process.env.VERCEL_ENV === 'production')
    throw new Error('CMS_PUBLISHED_READ_TOKEN is required');
  const fixture = new URL('../tests/fixtures/20261101.md', import.meta.url);
  await copyFile(fixture, new URL('20261101.md', directory));
  await removeStaleArticles(directory, new Set(['20261101.md']));
}
