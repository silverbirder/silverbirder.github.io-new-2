import { loadLinkCards, loadPublishedPosts } from '../../lib/posts.mjs';

export const posts = await loadPublishedPosts({ cards: await loadLinkCards() });
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const pathFor = (path = '/') => `${base}/${path.replace(/^\//, '')}`;
export const postPath = (slug) => pathFor(`/blog/contents/${slug}/`);
