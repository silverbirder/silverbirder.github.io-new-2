import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { mock } from 'node:test';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { After, Given, Then, When } from '@cucumber/cucumber';
import { copyPublishedArticles } from '../scripts/cms-github.mjs';

const tar = promisify(execFile);

Given('公開用アーカイブに1,000件の記事がある', async function () {
  await mkdir('.cache', { recursive: true });
  this.directory = await mkdtemp('.cache/cucumber-cms-');
  this.cache = pathToFileURL(`${this.directory}/`);
  this.destination = new URL('articles/', this.cache);
  await mkdir(this.destination);
  await mkdir(new URL('snapshot/published/', this.cache), { recursive: true });
  this.names = Array.from({ length: 1000 }, (_, index) =>
    index === 0 ? '20261101.md' : `article-${index}.md`,
  );
  await Promise.all(
    this.names.map((name) => writeFile(new URL(`snapshot/published/${name}`, this.cache), '本文')),
  );
  await tar('tar', ['-czf', 'published.tar.gz', 'snapshot'], { cwd: this.directory });
  this.archive = await readFile(new URL('published.tar.gz', this.cache));
});

When('ビルド用の記事を取得する', async function () {
  this.request = mock.method(globalThis, 'fetch', () =>
    Promise.resolve(new Response(this.archive)),
  );
  await copyPublishedArticles(this.cache, this.destination, 'test-token');
});

Then('GitHub APIの呼び出し1回で全記事を取得できる', async function () {
  assert.equal(this.request.mock.callCount(), 1);
  assert.match(this.request.mock.calls[0].arguments[0], /\/tarball\/published$/u);
  assert.deepEqual((await readdir(this.destination)).toSorted(), this.names.toSorted());
});

After(async function () {
  mock.restoreAll();
  if (this.directory) await rm(this.directory, { force: true, recursive: true });
});
