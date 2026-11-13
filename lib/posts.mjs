import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parsePost, renderMarkdown } from './content.mjs';

export async function loadPublishedPosts({ directory = process.env.CONTENT_DIR || './content', now = new Date(), cards = {} } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('現在時刻が不正です。');
  let entries;
  try { entries = await readdir(resolve(directory), { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const posts = await Promise.all(entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md')).map(async (entry) => {
    const slug = entry.name.slice(0, -3);
    const post = parsePost(await readFile(resolve(directory, entry.name), 'utf8'), slug);
    if (post.status !== 'published' || new Date(post.publishedAt).getTime() > now.getTime()) return null;
    return { ...post, html: await renderMarkdown(post.body, { cards }) };
  }));
  return posts.filter(Boolean).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
}

export async function loadLinkCards(file = process.env.LINK_CARDS_FILE) {
  if (!file) return {};
  const value = JSON.parse(await readFile(resolve(file), 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('リンクカードのスナップショットはオブジェクトにしてください。');
  return value;
}

export function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}
