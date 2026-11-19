import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const tar = promisify(execFile);
const archiveUrl =
  'https://api.github.com/repos/silverbirder/silverbirder.github.io-cms/tarball/published';
const articlePath = /^[A-Za-z0-9][\w.-]*\/published\/[A-Za-z0-9][A-Za-z0-9._-]*\.md$/u;

export async function copyPublishedArticles(cache, destination, token) {
  const response = await fetch(archiveUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`GitHub archive download failed (${response.status})`);

  const staging = await mkdtemp(fileURLToPath(new URL('cms-download-', cache)));
  const archive = `${staging}/published.tar.gz`;
  try {
    await writeFile(archive, new Uint8Array(await response.arrayBuffer()));
    const { stdout } = await tar('tar', ['-tzf', archive], { maxBuffer: 16 * 1024 * 1024 });
    const articles = stdout.split('\n').filter((path) => articlePath.test(path));
    if (!articles.some((path) => path.endsWith('/20261101.md')))
      throw new Error('The published archive is missing 20261101.md');

    const files = `${staging}/files.txt`;
    await writeFile(files, articles.join('\n') + '\n');
    await tar('tar', [
      '-xzf',
      archive,
      '-C',
      fileURLToPath(destination),
      '--strip-components',
      '2',
      '-T',
      files,
    ]);

    await removeStaleArticles(destination, new Set(articles.map((path) => path.split('/').at(-1))));
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function removeStaleArticles(directory, names) {
  const entries = await readdir(directory, { withFileTypes: true });
  const stale = entries.filter(({ name }) => name.endsWith('.md') && !names.has(name));
  await Promise.all(stale.map(({ name }) => rm(new URL(name, directory))));
  if (entries.some((entry) => names.has(entry.name) && !entry.isFile()))
    throw new Error('The published archive contains a non-file article');
}
