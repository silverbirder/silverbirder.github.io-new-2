import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parsePost, serializePost, renderMarkdown, validateSlug } from '../lib/content.mjs';
import { loadPublishedPosts, loadLinkCards } from '../lib/posts.mjs';

const article = (overrides = {}) => ({
  slug: 'sample-post', title: '試験用の記事', summary: '概要',
  body: '# 見出し\n\n本文です。', publishedAt: '2026-11-12T08:00:00+09:00',
  tags: ['試験'], keywords: ['記事'], index: true, status: 'published', ...overrides,
});

test('slug accepts only lower-case path segments and rejects traversal', () => {
  assert.equal(validateSlug('sample-123'), 'sample-123');
  for (const slug of ['../private', 'Upper', '/entry', 'post_name', 'a--b', '', '-post', 'post-', 'a%2fb', 'a'.repeat(81)]) {
    assert.throws(() => validateSlug(slug), TypeError);
  }
});

test('Markdown round-trip preserves article data and normalizes an ISO timestamp', () => {
  const saved = serializePost(article({ title: '引用: "テスト"', index: false }));
  const parsed = parsePost(saved, 'sample-post');
  assert.equal(parsed.title, '引用: "テスト"');
  assert.equal(parsed.body.trim(), '# 見出し\n\n本文です。');
  assert.equal(parsed.publishedAt, '2026-11-11T23:00:00.000Z');
  assert.equal(parsed.index, false);
  assert.equal(parsed.status, 'published');
  assert.deepEqual(parsed.tags, ['試験']);
  assert.deepEqual(parsed.keywords, ['記事']);
});

test('unmarked documents remain drafts and dates cannot silently roll over', () => {
  const base = '---\ntitle: テスト\npublishedAt: 2026-11-12\n---\n本文';
  assert.equal(parsePost(base, 'post').status, 'draft');
  assert.throws(() => parsePost(base.replace('2026-11-12', '2026-02-30'), 'post'), /日付/);
  assert.throws(() => parsePost(base.replace('2026-11-12', 'not-a-date'), 'post'), /ISO/);
  assert.throws(() => serializePost(article({ title: ' ' })), /title/);
  assert.throws(() => serializePost(article({ index: 'false' })), /index/);
});

test('GFM tables, task lists and safe HTML become static HTML', async () => {
  const html = await renderMarkdown('| 列 |\n| --- |\n| 値 |\n\n- [x] 完了\n\n<details><summary>詳細</summary>内容</details>');
  assert.match(html, /<table>/);
  assert.match(html, /<td>値<\/td>/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /checked/);
  assert.match(html, /<details><summary>詳細<\/summary>内容<\/details>/);
});

test('unsafe HTML and URL schemes are removed', async () => {
  const html = await renderMarkdown('<script>alert(1)</script>\n\n<img src="https://example.com/image.png" onerror="alert(2)">\n\n<a href="javascript:alert(3)">危険</a>\n\n<iframe src="https://example.com"></iframe>');
  assert.doesNotMatch(html, /<script|<iframe|onerror|javascript:|alert\(/);
  assert.match(html, /https:\/\/example.com\/image.png/);
});

test('link cards use only supplied snapshots and safely fall back to the domain', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = () => { requests++; throw new Error('外部取得は禁止'); };
  try {
    const html = await renderMarkdown('https://example.com/post\n\nhttps://unknown.example/path', {
      cards: { 'https://example.com/post': { title: '<script>カード</script>', description: '保存済みの説明', image: 'javascript:alert(1)' } },
    });
    assert.match(html, /class="link-card"/);
    assert.match(html, /(?:&lt;|&#x3C;)script>カード(?:&lt;|&#x3C;)\/script>/);
    assert.match(html, /保存済みの説明/);
    assert.match(html, /<strong>unknown.example<\/strong>/);
    assert.doesNotMatch(html, /<script|javascript:/);
    assert.equal(requests, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('public loading excludes drafts and future articles while retaining noindex articles', async () => {
  const directory = await mkdtemp(resolve('.test-content-'));
  try {
    const inputs = [article({ slug: 'older', publishedAt: '2026-11-10T00:00:00Z' }), article({ slug: 'noindex', index: false }), article({ slug: 'private-draft', status: 'draft' }), article({ slug: 'future', publishedAt: '2026-12-01T00:00:00Z' })];
    await Promise.all(inputs.map((post) => writeFile(resolve(directory, `${post.slug}.md`), serializePost(post))));
    const posts = await loadPublishedPosts({ directory, now: new Date('2026-11-13T00:00:00Z') });
    assert.deepEqual(posts.map((post) => post.slug), ['noindex', 'older']);
    assert.equal(posts[0].index, false);
    assert.match(posts[0].html, /<h1>見出し<\/h1>/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an empty input directory loads successfully and invalid clocks fail closed', async () => {
  const directory = await mkdtemp(resolve('.test-content-'));
  try {
    assert.deepEqual(await loadPublishedPosts({ directory }), []);
    assert.deepEqual(await loadPublishedPosts({ directory: resolve(directory, 'not-created') }), []);
    await assert.rejects(loadPublishedPosts({ directory, now: new Date('invalid') }), /現在時刻/);
    const cardsFile = resolve(directory, 'cards.json');
    await writeFile(cardsFile, '[]');
    await assert.rejects(loadLinkCards(cardsFile), /オブジェクト/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
