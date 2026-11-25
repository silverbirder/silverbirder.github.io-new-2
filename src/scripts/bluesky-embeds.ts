const posts = Array.from(document.querySelectorAll<HTMLElement>('[data-bluesky-actor]'));

async function didFor(actor: string): Promise<string | undefined> {
  if (actor.startsWith('did:')) return actor;
  const url = new URL('https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle');
  url.searchParams.set('handle', actor);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return;
    const { did } = await response.json();
    if (typeof did === 'string' && /^did:[\w.:%-]+$/u.test(did)) return did;
  } catch {
    // 取得できない投稿は元のリンクを表示する。
  }
}

const identifiers = new Map<string, Promise<string | undefined>>();
await Promise.all(
  posts.map(async (post) => {
    const { blueskyActor: actor, blueskyRecord: record } = post.dataset;
    if (!actor || !record) return;
    const lookup = identifiers.get(actor) ?? didFor(actor);
    identifiers.set(actor, lookup);
    const did = await lookup;
    if (did) post.dataset.blueskyUri = `at://${did}/app.bsky.feed.post/${record}`;
  }),
);

if (posts.some((post) => post.dataset.blueskyUri)) {
  const script = document.createElement('script');
  script.src = 'https://embed.bsky.app/static/embed.js';
  document.head.append(script);
}

export {};
