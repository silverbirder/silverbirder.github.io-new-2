import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export type BlogLinkCard = {
  url: string;
  domain: string;
  title: string;
  description?: string;
  image?: string;
};

const validImage = /^link-card\/([a-f0-9]{64})\.webp$/u;
const validArticle = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

function readManifest(directory: string): unknown {
  try {
    return JSON.parse(readFileSync(join(directory, 'link-cards.json'), 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWebp(bytes: Buffer) {
  return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

function imageHash(value: unknown, directory: string, images: Map<string, string>) {
  if (typeof value !== 'string') return;
  const hash = validImage.exec(value)?.[1];
  if (!hash) return;
  if (!images.has(hash)) {
    const file = join(directory, value);
    const stats = lstatSync(file, { throwIfNoEntry: false });
    if (!stats?.isFile() || stats.size > 32 * 1024) return;
    const bytes = readFileSync(file);
    if (!isWebp(bytes)) return;
    if (createHash('sha256').update(bytes).digest('hex') !== hash) return;
    images.set(hash, file);
  }
  return hash;
}

function parseCard(value: unknown, directory: string, images: Map<string, string>) {
  if (!record(value) || typeof value.url !== 'string' || typeof value.title !== 'string') return;
  const parsed = URL.parse(value.url);
  const title = value.title.trim().slice(0, 300);
  if (
    !parsed ||
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    return;
  if (!title) return;
  return {
    url: value.url,
    domain: parsed.hostname,
    title,
    description:
      typeof value.description === 'string' ? value.description.trim().slice(0, 300) : undefined,
    image: imageHash(value.thumbnail, directory, images),
  };
}

export function loadLinkCards(snapshot = process.env.BLOG_PUBLISHED_SNAPSHOT) {
  const articles = new Map<string, BlogLinkCard[]>();
  const images = new Map<string, string>();
  if (!snapshot) return { articles, images };

  // CircleCI attaches both outputs of the CMS export to the same workspace root.
  const directory = join(dirname(resolve(snapshot)), 'link-cards');
  const manifest = readManifest(directory);
  if (!record(manifest)) return { articles, images };

  for (const [article, entries] of Object.entries(manifest)) {
    if (!validArticle.test(article) || !Array.isArray(entries)) continue;
    const cards = entries.flatMap((entry) => {
      const card = parseCard(entry, directory, images);
      return card ? [card] : [];
    });
    if (cards.length > 0) articles.set(article, cards);
  }
  return { articles, images };
}
