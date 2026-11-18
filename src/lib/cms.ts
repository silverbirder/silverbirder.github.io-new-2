import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'astro/zod';

const REQUEST_TIMEOUT_MS = 25_000;
const assetSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}\.(?:png|jpg|webp|gif|avif)$/u),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']),
});
const postSchema = z.object({
  slug: z.string().regex(/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u),
  title: z.string().min(1),
  publishedAt: z.union([z.iso.date(), z.iso.datetime({ offset: true })]),
  summary: z.string(),
  tags: z.array(z.string()),
  keywords: z.array(z.string()),
  index: z.boolean(),
  html: z.string(),
  assets: z.array(assetSchema),
});
const feedSchema = z.object({ version: z.literal(1), posts: z.array(postSchema) });

export type CMSPost = z.infer<typeof postSchema>;
type CMSAsset = z.infer<typeof assetSchema>;

let postsPromise: Promise<CMSPost[]> | undefined;

function snapshotDirectory() {
  const value = process.env.CMS_SNAPSHOT_PATH;
  if (value && process.env.CMS_CONTENT_URL) {
    throw new Error('Configure only one CMS content source');
  }
  return value ? resolve(value) : null;
}

function contentURL() {
  const value = process.env.CMS_CONTENT_URL;
  if (!value) return null;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('CMS_CONTENT_URL must be an HTTP URL without credentials');
  }
  return url;
}

async function fetchCMS(url: URL) {
  const response = await fetch(url, {
    headers: { Origin: url.origin },
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CMS request failed (${response.status}): ${url.pathname}`);
  return response;
}

async function loadPosts() {
  const directory = snapshotDirectory();
  let input: unknown;
  if (directory) {
    input = JSON.parse(await readFile(join(directory, 'feed.json'), 'utf8'));
  } else {
    const url = contentURL();
    if (!url) return [];
    input = await (await fetchCMS(url)).json();
  }
  const { posts } = feedSchema.parse(input);
  const slugs = new Set(posts.map((post) => post.slug));
  if (slugs.size !== posts.length || slugs.has('20261101')) {
    throw new Error('CMS posts contain duplicate or reserved URLs');
  }
  for (const post of posts) {
    if (
      /(?:src|href)=["'](?:blob:|https?:\/\/(?:localhost|127\.0\.0\.1)(?:[:/]|["']))/iu.test(
        post.html,
      )
    ) {
      throw new Error(`CMS post contains a browser-local URL: ${post.slug}`);
    }
  }
  return posts;
}

export function getCMSPosts() {
  postsPromise ??= loadPosts();
  return postsPromise;
}

export function cmsPostURL(slug: string) {
  return `${import.meta.env.BASE_URL}blog/contents/${encodeURIComponent(slug)}/`;
}

export function cmsPostHTML(post: CMSPost) {
  const base = import.meta.env.BASE_URL;
  return post.html
    .replaceAll('src="/cms-media/', `src="${base}cms-media/`)
    .replaceAll('href="/cms-media/', `href="${base}cms-media/`);
}

export async function getCMSAssets() {
  const posts = await getCMSPosts();
  return [
    ...new Map(posts.flatMap((post) => post.assets).map((asset) => [asset.id, asset])).values(),
  ];
}

export async function fetchCMSAsset(asset: CMSAsset) {
  const directory = snapshotDirectory();
  let bytes: ArrayBuffer;
  if (directory) {
    bytes = Uint8Array.from(await readFile(join(directory, 'media', asset.id))).buffer;
  } else {
    const url = contentURL();
    if (!url) throw new Error('A CMS content source is required for CMS media');
    const response = await fetchCMS(new URL(`/api/new2/assets/${asset.id}`, url));
    if (response.headers.get('content-type')?.split(';')[0] !== asset.contentType) {
      throw new Error(`CMS media has an unexpected content type: ${asset.id}`);
    }
    bytes = await response.arrayBuffer();
  }
  const hash = createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
  if (hash !== asset.id.split('.')[0]) throw new Error(`CMS media checksum failed: ${asset.id}`);
  return bytes;
}
