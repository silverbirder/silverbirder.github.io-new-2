import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { After, Given, Then, When } from '@cucumber/cucumber';
import { loadLinkCards } from '../src/lib/blog-link-card-source.ts';
import { insertArticleBlocks } from '../src/lib/insert-link-cards.ts';

const url = String.raw`https://example.com/photo#day=1\&view=2`;
const bareLink = String.raw`<a href="https://example.com/photo#day=1%5C&amp;view=2">https://example.com/photo#day=1\&amp;view=2</a>`;
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
  this.articleBlocks = insertArticleBlocks(
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

Given('記事にYouTube、CodePen、X、Instagram、Blueskyへの独立したリンクがある', function () {
  this.embedHtml = [
    '<p>https://youtu.be/M7lc1UVf-VE?t=15s</p>',
    '<p><a href="https://codepen.io/chriscoyier/pen/gfdDu?default-tab=result">デモ</a></p>',
    '<p><a href="https://x.com/Interior/status/463440424141459456/photo/1">投稿</a></p>',
    '<p><a href="https://www.instagram.com/reels/ABC123/">動画</a></p>',
    '<p><a href="https://bsky.app/profile/example.bsky.social/post/3abc">投稿</a></p>',
  ].join('');
});

Given('記事に本文内のYouTubeリンクと対象外のURLがある', function () {
  this.embedHtml = [
    '<p>本文内の<a href="https://youtu.be/M7lc1UVf-VE">動画</a>です。</p>',
    '<p>https://x.com/Interior/status/463440424141459456/ に続く本文</p>',
    '<p><a href="https://youtu.be/M7lc1UVf-VE"><img src="/thumbnail.png" alt="動画"></a></p>',
    '<p>https://youtu.be.example.com/M7lc1UVf-VE</p>',
    '<p>https://x.com/Interior</p>',
  ].join('');
});

When('記事の表示用ブロックに変換する', function () {
  this.embedBlocks = insertArticleBlocks(this.embedHtml);
});

Then('各リンクをサービスに対応した埋め込みにする', function () {
  const embeds = this.embedBlocks.filter((block) => typeof block !== 'string');
  assert.deepEqual(
    embeds.map((embed) => embed.provider),
    ['youtube', 'codepen', 'x', 'instagram', 'bluesky'],
  );
  assert.equal(embeds[0].src, 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?start=15');
  assert.equal(embeds[1].src, 'https://codepen.io/chriscoyier/embed/gfdDu?default-tab=result');
  assert.equal(embeds[2].url, 'https://twitter.com/Interior/status/463440424141459456');
  assert.equal(embeds[3].url, 'https://www.instagram.com/reel/ABC123/');
  assert.equal(embeds[4].actor, 'example.bsky.social');
});

Then('本文内のリンクと対象外のURLはそのまま表示する', function () {
  assert.deepEqual(this.embedBlocks, [this.embedHtml]);
});
