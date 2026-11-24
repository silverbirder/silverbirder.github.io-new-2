import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { After, Given, Then, When } from '@cucumber/cucumber';
import { loadLinkCards } from '../src/lib/blog-link-card-source.ts';
import { insertLinkCards } from '../src/lib/insert-link-cards.ts';

const url = 'https://example.com/photo#day=1\\&view=2';
const bareLink =
  '<a href="https://example.com/photo#day=1%5C&amp;view=2">https://example.com/photo#day=1\\&amp;view=2</a>';
const unchanged =
  '<ul><li><p>' +
  bareLink +
  '</p></li></ul>' +
  '<p>本文の <a href="' +
  url +
  '">写真へのリンク</a></p>' +
  '<p><a href="https://example.com/plain">https://example.com/plain</a></p>';

async function seed(world, withImage) {
  await mkdir('.cache', { recursive: true });
  world.linkCardDir = await mkdtemp('.cache/cucumber-cards-');
  const data = join(world.linkCardDir, 'link-cards');
  await mkdir(join(data, 'link-card'), { recursive: true });
  const image = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
  world.imageHash = createHash('sha256').update(image).digest('hex');
  const thumbnail = 'link-card/' + world.imageHash + '.webp';
  if (withImage) await writeFile(join(data, thumbnail), image);
  await writeFile(
    join(data, 'link-cards.json'),
    JSON.stringify({
      article: [{ url, title: '記事のタイトル', description: '記事の概要', thumbnail }],
    }),
  );
  world.snapshot = join(world.linkCardDir, 'snapshot');
}

Given('CMSのスナップショットにタイトルとサムネイルがある', async function () {
  await seed(this, true);
});
Given('CMSのスナップショットにサムネイルがない', async function () {
  await seed(this, false);
});

When('記事のURLにリンクカードを当てはめる', function () {
  const { articles, images } = loadLinkCards(this.snapshot);
  this.assets = images;
  this.articleBlocks = insertLinkCards(
    '<p>' + bareLink + '</p>' + unchanged,
    articles.get('article'),
  );
});

Then('URLだけの段落がカードに変わり、そのほかの本文は保たれる', function () {
  assert.equal(this.articleBlocks.length, 3);
  assert.equal(this.articleBlocks[1].image, this.imageHash);
  assert.equal(this.articleBlocks[2], unchanged);
  assert.equal(this.assets.size, 1);
});

Then('タイトルと説明を含む画像なしカードになる', function () {
  assert.equal(this.articleBlocks[1].title, '記事のタイトル');
  assert.equal(this.articleBlocks[1].description, '記事の概要');
  assert.equal(this.articleBlocks[1].image, undefined);
  assert.equal(this.assets.size, 0);
});

After(async function () {
  if (this.linkCardDir) await rm(this.linkCardDir, { recursive: true, force: true });
});
