import { articleSlug } from './article-slug';

export const siteName = 'ジブンノート';
export const siteDescription = 'silverbirderのジブンノート';
export const authorName = 'silverbirder';

export function siteUrl(path = '') {
  return new URL(path, 'https://silverbirder.github.io/').href;
}

export function articlePath(id: string) {
  return `blog/contents/${encodeURIComponent(articleSlug(id))}/`;
}
