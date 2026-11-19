import { copyFile, mkdir } from 'node:fs/promises';
import { copyArticles, download, readTree } from './cms-github.mjs';

const directory = new URL('../.cache/cms-published/', import.meta.url);
const archive = new URL('../.cache/cms-archive/', import.meta.url);
const articlePath = /^published\/([A-Za-z0-9][A-Za-z0-9._-]*\.md)$/u;

await mkdir(directory, { recursive: true });

const token = process.env.CMS_PUBLISHED_READ_TOKEN;
if (!token) {
  if (process.env.VERCEL_ENV === 'production')
    throw new Error('CMS_PUBLISHED_READ_TOKEN is required');
  const fixture = new URL('../tests/fixtures/20261101.md', import.meta.url);
  await copyFile(fixture, new URL('20261101.md', directory));
  await copyArticles([], archive);
} else {
  const tree = await readTree('published', token);
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
  await copyArticles(entries, directory, token);

  const [catalog, originalTree] = await Promise.all([
    download(
      '/contents/articles.json?ref=original-articles',
      token,
      'application/vnd.github.raw+json',
    ),
    readTree('original-articles', token),
  ]);
  const original = new Map(
    originalTree.filter(({ type }) => type === 'blob').map(({ path, sha }) => [path, sha]),
  );
  const originals = (await catalog.json())
    .filter((article) => article.public)
    .map(({ slug }) => {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(slug))
        throw new Error('Invalid original article slug');
      const name = `${slug}.md`;
      const sha = original.get(`imported/${name}`);
      if (!sha) throw new Error(`Missing original article ${name}`);
      return { name, sha };
    });
  await copyArticles(originals, archive, token);
}
