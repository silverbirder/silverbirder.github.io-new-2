const origin = 'https://embed.bsky.app';
const posts = [...document.querySelectorAll<HTMLElement>('[data-bluesky-actor]')];

async function didFor(actor: string, retry = true): Promise<string | undefined> {
  if (actor.startsWith('did:')) return actor;
  const url = new URL('https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle');
  url.searchParams.set('handle', actor);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const { did } = await response.json();
      return typeof did === 'string' && /^did:[\w.:%-]+$/u.test(did) ? did : undefined;
    }
    if (response.status < 500 && response.status !== 429) return;
  } catch {
    // 一時的な通信エラーは再試行する。
  }
  if (retry) return didFor(actor, false);
}

const frames = new Map<string, { frame: HTMLIFrameElement; fallback: HTMLElement }>();
if (posts.length) {
  window.addEventListener('message', (event) => {
    if (event.origin !== origin) return;
    const { id, height } = (event.data ?? {}) as {
      id?: string;
      height?: number;
    };
    if (typeof id !== 'string' || typeof height !== 'number') return;
    const entry = frames.get(id);
    if (!entry?.frame.contentWindow || event.source !== entry.frame.contentWindow) return;
    if (!Number.isFinite(height) || height <= 0) return;
    entry.frame.height = String(Math.ceil(height));
    entry.fallback.hidden = true;
  });
}

const identifiers = new Map<string, Promise<string | undefined>>();
await Promise.all(
  posts.map(async (post, index) => {
    const { blueskyActor: actor, blueskyRecord: record } = post.dataset;
    if (!actor || !record) return;
    const lookup = identifiers.get(actor) ?? didFor(actor);
    identifiers.set(actor, lookup);
    const did = await lookup;
    if (!did) return;

    const id = String(index);
    const url = new URL(origin);
    // 公式iframeに渡すDIDの区切りはコロンで残す。
    const didSegment = encodeURIComponent(did).replaceAll('%3A', ':');
    url.pathname = ['/embed', didSegment, 'app.bsky.feed.post', encodeURIComponent(record)].join(
      '/',
    );
    url.searchParams.set('colorMode', 'system');
    url.searchParams.set('id', id);

    const frame = document.createElement('iframe');
    frame.loading = 'lazy';
    frame.title = 'Blueskyの投稿';
    frame.height = '220';
    frame.style.cssText =
      'display:block;width:var(--primitive-size-full);max-width:600px;margin-inline:auto;border:0';
    frame.src = url.href;
    frames.set(id, { frame, fallback: post });
    post.before(frame);
  }),
);
