import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { mock } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { After, Given, Then, When } from '@cucumber/cucumber';
import { copyPublishedSnapshot } from '../scripts/cms-snapshot.mjs';

Given('公開用スナップショットに1,000件の記事がある', async function () {
  await mkdir('.cache', { recursive: true });
  this.directory = await mkdtemp('.cache/cucumber-cms-');
  const cache = pathToFileURL(`${this.directory}/`);
  this.destination = new URL('articles/', cache);
  this.snapshot = new URL('snapshot/', cache);
  await Promise.all([mkdir(this.destination), mkdir(this.snapshot)]);
  this.names = Array.from({ length: 1000 }, (_, index) => `article-${index}.md`);
  await Promise.all(this.names.map((name) => writeFile(new URL(name, this.snapshot), '本文')));
  await writeFile(new URL('removed.md', this.destination), '削除済み');
});

When('ビルド用の記事を取得する', async function () {
  this.request = mock.method(globalThis, 'fetch', () => {
    throw new Error('Unexpected network request');
  });
  await copyPublishedSnapshot(fileURLToPath(this.snapshot), this.destination);
});

Then('CMSに接続せず、スナップショットから全記事を読み込める', async function () {
  assert.equal(this.request.mock.callCount(), 0);
  assert.deepEqual((await readdir(this.destination)).toSorted(), this.names.toSorted());
});

After(async function () {
  mock.restoreAll();
  if (this.directory) await rm(this.directory, { force: true, recursive: true });
});
