export const articleSlug = (publishedAt: string) => publishedAt.slice(0, 10).replaceAll('-', '');
