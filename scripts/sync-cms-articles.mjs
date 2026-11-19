import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';

const directory = new URL('../.cache/cms-published/', import.meta.url);
const repository = 'https://api.github.com/repos/silverbirder/silverbirder.github.io-cms';
const articlePath = /^published\/([a-z0-9][a-z0-9-]*\.md)$/u;

async function download(path, token, accept = 'application/vnd.github+json') {
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
if (token) {
  const ref = await download('/git/ref/heads/published', token);
  const { object } = await ref.json();
  const treeResponse = await download(`/git/trees/${object.sha}?recursive=1`, token);
  const { tree, truncated } = await treeResponse.json();
  if (truncated) throw new Error('The CMS published article tree is incomplete');

  const entries = tree.flatMap(({ path, type, sha }) => {
    const name = articlePath.exec(path)?.[1];
    return type === 'blob' && name ? [{ name, sha }] : [];
  });
  const articles = new Set(entries.map(({ name }) => name));
  const batchSize = 10;
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    // Keep concurrent GitHub requests below the secondary rate limit.
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      entries.slice(offset, offset + batchSize).map(async ({ name, sha }) => {
        const response = await download(
          `/git/blobs/${sha}`,
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
