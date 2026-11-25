type InstagramWindow = Window & {
  instgrm?: { Embeds?: { process: () => void } };
};

const selector = '[data-embed="instagram"]';
const source = 'https://www.instagram.com/embed.js';

function processPosts() {
  (window as InstagramWindow).instgrm?.Embeds?.process();
}

function nameFrames(post: HTMLElement) {
  for (const frame of post.querySelectorAll('iframe:not([title])')) {
    frame.setAttribute('title', 'Instagramの投稿');
  }
}

function loadScript(retry: boolean) {
  const script = document.createElement('script');
  script.async = true;
  script.src = source;
  script.addEventListener('load', processPosts, { once: true });
  script.addEventListener(
    'error',
    () => {
      script.remove();
      if (retry) loadScript(false);
    },
    { once: true },
  );
  document.body.append(script);
}

const posts = [...document.querySelectorAll<HTMLElement>(selector)];
if (posts.length) {
  for (const post of posts) {
    new MutationObserver(() => nameFrames(post)).observe(post, {
      childList: true,
      subtree: true,
    });
    nameFrames(post);
  }

  const current = document.querySelector('script[src="' + source + '"]');
  if ((window as InstagramWindow).instgrm?.Embeds) processPosts();
  else if (current) current.addEventListener('load', processPosts, { once: true });
  else loadScript(true);
}
