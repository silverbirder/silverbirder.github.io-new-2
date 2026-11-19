import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';

const repository = 'https://api.github.com/repos/silverbirder/silverbirder.github.io-cms';
const githubReadPath =
  /^\/(?:git\/(?:ref\/heads\/(?:published|original-articles)|trees\/[a-f0-9]{40}\?recursive=1|blobs\/[a-f0-9]{40})|contents\/articles\.json\?ref=original-articles)$/u;

export async function download(path, token, accept = 'application/vnd.github+json') {
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

export async function readTree(branch, token) {
  const ref = await download(`/git/ref/heads/${branch}`, token);
  const { object } = await ref.json();
  const response = await download(
    `/git/trees/${encodeURIComponent(object.sha)}?recursive=1`,
    token,
  );
  const { tree, truncated } = await response.json();
  if (truncated) throw new Error('The CMS article tree is incomplete');
  return tree;
}

export async function copyArticles(entries, directory, token) {
  await mkdir(directory, { recursive: true });
  const names = new Set(entries.map(({ name }) => name));
  const batchSize = 10;
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    // Limit concurrent GitHub downloads.
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
    (name) => name.endsWith('.md') && !names.has(name),
  );
  await Promise.all(stale.map((name) => unlink(new URL(name, directory))));
}
