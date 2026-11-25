type Tweet = {
  text: string;
  created_at: string;
  display_text_range?: [number, number];
  user: { name: string; screen_name: string };
  photos?: { url: string; width: number; height: number }[];
  video?: {
    aspectRatio: [number, number];
    poster: string;
    variants: { src: string; type: string }[];
  };
  quoted_tweet?: Tweet & { id_str: string };
};

async function fetchTweet(id: string, retry = true): Promise<Tweet | undefined> {
  try {
    const response = await fetch('https://react-tweet.vercel.app/api/tweet/' + id, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const { data } = (await response.json()) as { data?: Tweet };
      return data;
    }
    if (response.status < 500 && response.status !== 429) return;
  } catch {
    // 通信が一時的に失敗したら再試行する。
  }
  if (retry) return fetchTweet(id, false);
}

function appendMedia(target: HTMLElement, tweet: Tweet) {
  const video = tweet.video;
  const source = video?.variants.find(
    (variant) => variant.type === 'video/mp4' && variant.src.startsWith('https://'),
  );
  if (video && source) {
    const player = document.createElement('video');
    player.controls = true;
    player.playsInline = true;
    player.preload = 'none';
    player.src = source.src;
    player.style.aspectRatio = video.aspectRatio.join(' / ');
    if (video.poster.startsWith('https://')) player.poster = video.poster;
    target.append(player);
    return;
  }
  for (const photo of tweet.photos ?? []) {
    if (!photo.url.startsWith('https://')) continue;
    const image = document.createElement('img');
    image.src = photo.url;
    image.width = photo.width;
    image.height = photo.height;
    image.style.height = 'auto';
    image.loading = 'lazy';
    image.alt = '';
    target.append(image);
  }
}

function buildCard(template: HTMLTemplateElement, tweet: Tweet): DocumentFragment {
  const card = document.importNode(template.content, true);
  const author = card.querySelector<HTMLElement>('[data-x-author]');
  const handle = card.querySelector<HTMLElement>('[data-x-handle]');
  const text = card.querySelector<HTMLElement>('[data-x-text]');
  const date = card.querySelector<HTMLTimeElement>('time');
  const media = card.querySelector<HTMLElement>('[data-x-media]');
  if (author) author.textContent = tweet.user.name;
  if (handle) handle.textContent = ' @' + tweet.user.screen_name;
  if (text) {
    const range = tweet.display_text_range;
    text.textContent = range ? [...tweet.text].slice(...range).join('') : tweet.text;
  }
  const published = new Date(tweet.created_at);
  if (date && Number.isFinite(published.getTime())) {
    date.dateTime = published.toISOString();
    date.textContent = published.toLocaleDateString('ja-JP');
  }
  if (media) appendMedia(media, tweet);
  return card;
}

function appendQuote(template: HTMLTemplateElement, card: DocumentFragment, tweet: Tweet) {
  const quote = tweet.quoted_tweet;
  if (!quote?.user || !/^\d+$/u.test(quote.id_str)) return;
  const quotedCard = buildCard(template, quote);
  const link = quotedCard.querySelector('a');
  if (link) link.href = 'https://x.com/i/web/status/' + quote.id_str;
  card.querySelector('section')?.append(quotedCard);
}

await Promise.all(
  Array.from(document.querySelectorAll<HTMLElement>('[data-x-post]'), async (post) => {
    const id = post.dataset.xPost;
    const template = post.querySelector('template');
    if (!id || !template) return;
    try {
      const tweet = await fetchTweet(id);
      if (!tweet?.user || typeof tweet.text !== 'string') return;
      const card = buildCard(template, tweet);
      appendQuote(template, card, tweet);
      post.replaceChildren(card);
    } catch {
      // 表示できない投稿は元のリンクを残す。
    }
  }),
);
