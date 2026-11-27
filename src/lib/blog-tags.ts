import { Buffer } from 'node:buffer';

export function articleTags(tags?: readonly string[] | null) {
  return [...new Set(tags?.map((tag) => tag.trim()).filter(Boolean))];
}

export function blogTagSlug(tag: string) {
  // 区切り文字や大文字を含むタグも、個別のパスに割り当てる。
  if (/^[\p{L}\p{N}_-]+$/u.test(tag) && tag === tag.toLowerCase().normalize('NFC')) {
    return tag;
  }
  return '~' + Buffer.from(tag).toString('hex');
}

export function blogTagHref(tag: string) {
  return `${import.meta.env.BASE_URL}blog/tags/${encodeURIComponent(blogTagSlug(tag))}/`;
}
