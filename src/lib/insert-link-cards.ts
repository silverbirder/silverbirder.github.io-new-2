import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import type { BlogLinkCard } from './blog-link-card-source';

type PlayerEmbed = { provider: 'youtube' | 'codepen'; url: string; src: string };
type SocialEmbed = { provider: 'x' | 'instagram'; url: string };
type BlueskyEmbed = { provider: 'bluesky'; url: string; actor: string; record: string };
export type ArticleEmbed = PlayerEmbed | SocialEmbed | BlueskyEmbed;

const youtubeHosts = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
]);

function youtubeVideoId(url: URL, host: string) {
  if (host === 'youtu.be') return url.pathname.slice(1).replace(/\/$/u, '');
  if (url.pathname === '/watch') return url.searchParams.get('v');
  return /^\/(?:embed|shorts)\/([\w-]+)\/?$/u.exec(url.pathname)?.[1];
}

function youtube(url: URL, host: string): PlayerEmbed | undefined {
  const video = youtubeVideoId(url, host);
  if (!video || !/^[\w-]{11}$/u.test(video)) return;

  const src = new URL(`https://www.youtube-nocookie.com/embed/${video}`);
  const start = url.searchParams.get('start') ?? url.searchParams.get('t');
  if (start && /^\d+s?$/u.test(start)) src.searchParams.set('start', start.replace(/s$/u, ''));
  return { provider: 'youtube', url: url.href, src: src.href };
}

function codepen(url: URL): PlayerEmbed | undefined {
  const pen = /^\/([\w-]+)\/(?:pen|embed)\/([\w-]+)\/?$/u.exec(url.pathname);
  if (!pen) return;

  const [, author, id] = pen;
  const src = new URL(`https://codepen.io/${author}/embed/${id}`);
  src.search = url.search;
  return { provider: 'codepen', url: url.href, src: src.href };
}

function social(url: URL, host: string): ArticleEmbed | undefined {
  if (host === 'x.com' || host === 'twitter.com' || host === 'mobile.twitter.com') {
    const post = /^\/(?:\w+|i\/web)\/status\/\d+(?=\/|$)/u.exec(url.pathname)?.[0];
    if (post) return { provider: 'x', url: `https://twitter.com${post}` };
  }
  if (host === 'instagram.com') {
    const match = /^\/(p|reels?|tv)\/([\w-]+)(?:\/|$)/u.exec(url.pathname);
    if (match) {
      const [, kind, id] = match;
      return {
        provider: 'instagram',
        url: `https://www.instagram.com/${kind === 'reels' ? 'reel' : kind}/${id}/`,
      };
    }
  }
}

function bluesky(url: URL): BlueskyEmbed | undefined {
  const match = /^\/profile\/([\w.:%-]+)\/post\/([\w.-]+)\/?$/u.exec(url.pathname);
  if (!match) return;
  const actor = match[1].replace(/%3a/giu, ':');
  return { provider: 'bluesky', url: url.href, actor, record: match[2] };
}

function articleEmbed(href: string): ArticleEmbed | undefined {
  if (/\s/u.test(href)) return;
  const url = URL.parse(href);
  if (
    !url ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  )
    return;

  url.protocol = 'https:';
  const host = url.hostname.replace(/^www\./u, '');
  if (youtubeHosts.has(host)) return youtube(url, host);
  if (host === 'codepen.io') return codepen(url);
  if (host === 'bsky.app') return bluesky(url);
  return social(url, host);
}

type Child = DefaultTreeAdapterTypes.ChildNode;

function isElement(node: Child, tag: string): node is DefaultTreeAdapterTypes.Element {
  return 'tagName' in node && node.tagName === tag;
}

function soleChild(children: Child[]) {
  const nodes = children.filter((child) => !('value' in child) || child.value.trim());
  return nodes.length === 1 ? nodes[0] : undefined;
}

function unlabelledUrl(link: DefaultTreeAdapterTypes.Element) {
  const [href] = link.attrs;
  if (link.attrs.length !== 1 || href.name !== 'href') return;
  const label = soleChild(link.childNodes);
  if (!label || !('value' in label)) return;
  const text = label.value.trim();
  const target = URL.parse(text);
  // The Markdown renderer percent-encodes a backslash even inside a URL fragment.
  if (target && target.href.replaceAll('\\', '%5C') === URL.parse(href.value)?.href) return text;
}

function linkedEmbed(link: DefaultTreeAdapterTypes.Element) {
  const text = soleChild(link.childNodes);
  const href = link.attrs.find((attribute) => attribute.name === 'href')?.value;
  if (href && text && 'value' in text) return articleEmbed(href);
}

function paragraphBlock(
  paragraph: DefaultTreeAdapterTypes.Element,
  links: Map<string, BlogLinkCard>,
) {
  const child = soleChild(paragraph.childNodes);
  if (!child) return;
  if ('value' in child) {
    const url = child.value.trim();
    return articleEmbed(url) ?? links.get(url);
  }
  if (!isElement(child, 'a')) return;
  const cardUrl = unlabelledUrl(child);
  return linkedEmbed(child) ?? (cardUrl ? links.get(cardUrl) : undefined);
}

export function insertArticleBlocks(html: string, cards: BlogLinkCard[] = []) {
  const links = new Map(cards.map((card) => [card.url, card]));
  const fragment = parseFragment(html, { sourceCodeLocationInfo: true });
  const blocks: (string | BlogLinkCard | ArticleEmbed)[] = [];
  let offset = 0;
  for (const node of fragment.childNodes) {
    if (!node.sourceCodeLocation) continue;
    const { startOffset, endOffset } = node.sourceCodeLocation;
    if (isElement(node, 'pre')) {
      blocks.push(
        html.slice(offset, startOffset),
        `<div class="notebook-code-frame">${html.slice(startOffset, endOffset)}</div>`,
      );
      offset = endOffset;
    } else if (isElement(node, 'p') && node.attrs.length === 0) {
      const block = paragraphBlock(node, links);
      if (!block) continue;
      blocks.push(html.slice(offset, startOffset), block);
      offset = endOffset;
    }
  }
  blocks.push(html.slice(offset));
  return blocks;
}
