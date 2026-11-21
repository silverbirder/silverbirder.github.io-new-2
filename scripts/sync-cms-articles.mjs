import { copyFile, mkdir } from 'node:fs/promises';
import { copyPublishedSnapshot, removeStaleArticles } from './cms-snapshot.mjs';

const cache = new URL('../.cache/', import.meta.url);
const directory = new URL('cms-published/', cache);
await mkdir(directory, { recursive: true });

const snapshot = process.env.BLOG_PUBLISHED_SNAPSHOT;
if (snapshot) {
  await copyPublishedSnapshot(snapshot, directory);
} else {
  if (process.env.VERCEL_ENV === 'production')
    throw new Error('BLOG_PUBLISHED_SNAPSHOT is required');
  const fixture = new URL('../tests/fixtures/20261101.md', import.meta.url);
  await copyFile(fixture, new URL('20261101.md', directory));
  await removeStaleArticles(directory, new Set(['20261101.md']));
}
