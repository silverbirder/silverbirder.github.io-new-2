import { copyFile, mkdir, readdir, unlink, writeFile } from 'node:fs/promises';

const directory = new URL('../.cache/cms-published/', import.meta.url);
const repository = 'https://api.github.com/repos/silverbirder/silverbirder.github.io-cms';
const githubReadPath =
  /^\/git\/(?:ref\/heads\/published|trees\/[a-f0-9]{40}\?recursive=1|blobs\/[a-f0-9]{40})$/u;
const articlePath = /^published\/([A-Za-z0-9][A-Za-z0-9._-]*\.md)$/u;

async function download(path, token, accept = 'application/vnd.github+json') {
  if (!githubReadPath.test(path)) throw new Error('Invalid CMS publication path');
  const response = await fetch(repository + path, {
    headers: { Accept: accept, Authorization: `Bearer ${token}` },
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(`GitHub returned ${response.status} while reading published articles`);
  return response;
}

await mkdir(directory, { recursive: true });

const token = process.env.CMS_PUBLISHED_READ_TOKEN;
if (!token) {
  if (process.env.VERCEL_ENV === 'production')
    throw new Error('CMS_PUBLISHED_READ_TOKEN is required');
  const fixture = new URL('../tests/fixtures/20261101.md', import.meta.url);
  await copyFile(fixture, new URL('20261101.md', directory));
} else {
  const ref = await download('/git/ref/heads/published', token);
  const { object } = await ref.json();
  const treeResponse = await download(
    `/git/trees/${encodeURIComponent(object.sha)}?recursive=1`,
    token,
  );
  const { tree, truncated } = await treeResponse.json();
  if (truncated) throw new Error('The CMS published article tree is incomplete');

  const entries = tree.flatMap(({ path, type, sha }) => {
    const name = articlePath.exec(path)?.[1];
    return type === 'blob' && name ? [{ name, sha }] : [];
  });
  const articles = new Set(entries.map(({ name }) => name));
  const imported = tree.find(
    ({ path, type }) => path === 'imported/20261101.md' && type === 'blob',
  );
  if (imported && !articles.has('20261101.md')) {
    entries.push({ name: '20261101.md', sha: imported.sha });
    articles.add('20261101.md');
  }

  if (!articles.has('20261101.md'))
    throw new Error('The existing article 20261101.md is missing from CMS');
  const batchSize = 10;
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    // Keep concurrent GitHub requests below the secondary rate limit.
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      entries.slice(offset, offset + batchSize).map(async ({ name, sha }) => {
        const response = await download(
          `/git/blobs/${encodeURIComponent(sha)}`,
          token,
          'application/vnd.github.raw+json',
        );
        await writeFile(new URL(name, directory), await response.text());
      }),
    );
  }

  const stale = (await readdir(directory)).filter(
    (name) => name.endsWith('.md') && !articles.has(name),
  );
  await Promise.all(stale.map((name) => unlink(new URL(name, directory))));
}
