import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { parseDocument } from 'yaml';

const tar = promisify(execFile);
const archiveUrl =
  'https://api.github.com/repos/silverbirder/silverbirder.github.io-cms/tarball/content';
const articlePath = /^[A-Za-z0-9][\w.-]*\/published\/[A-Za-z0-9][A-Za-z0-9._-]*\.md$/u;

function isPublished(source) {
  const header = /^(?:\uFEFF)?---[\t ]*\r?\n/u.exec(source);
  if (!header) return false;
  const rest = source.slice(header[0].length);
  const closing = /^(?:---|\.\.\.)[\t ]*\r?$/mu.exec(rest);
  if (!closing) return false;
  const yaml = parseDocument(rest.slice(0, closing.index));
  if (yaml.errors.length) throw new Error('Invalid content frontmatter');
  return yaml.get('publicationStatus') === 'published';
}

async function copyPublishedFiles(extracted, destination) {
  const entries = await readdir(extracted, { withFileTypes: true });
  const names = new Set();
  for (const entry of entries) {
    if (!entry.isFile()) throw new Error('The content archive contains a non-file entry');
    const source = new URL(entry.name, extracted);
    // eslint-disable-next-line no-await-in-loop -- bound memory usage when scanning the archive
    if (!isPublished(await readFile(source, 'utf8'))) continue;
    // eslint-disable-next-line no-await-in-loop -- copy only files already verified as published
    await copyFile(source, new URL(entry.name, destination));
    names.add(entry.name);
  }
  await removeStaleArticles(destination, names);
}

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

    const extracted = new URL('files/', pathToFileURL(`${staging}/`));
    await mkdir(extracted);
    const files = `${staging}/files.txt`;
    await writeFile(files, articles.join('\n') + '\n');
    if (articles.length)
      await tar('tar', [
        '-xzf',
        archive,
        '-C',
        fileURLToPath(extracted),
        '--strip-components',
        '2',
        '-T',
        files,
      ]);

    await copyPublishedFiles(extracted, destination);
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
