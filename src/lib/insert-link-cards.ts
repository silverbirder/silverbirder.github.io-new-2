import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import type { BlogLinkCard } from './blog-link-card-source';

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

function paragraphUrl(paragraph: DefaultTreeAdapterTypes.Element) {
  const child = soleChild(paragraph.childNodes);
  if (!child) return;
  if ('value' in child) return child.value.trim();
  if (isElement(child, 'a')) return unlabelledUrl(child);
}

export function insertLinkCards(html: string, cards: BlogLinkCard[]) {
  const links = new Map(cards.map((card) => [card.url, card]));
  const fragment = parseFragment(html, { sourceCodeLocationInfo: true });
  const blocks: (string | BlogLinkCard)[] = [];
  let offset = 0;
  for (const node of fragment.childNodes) {
    if (!isElement(node, 'p') || node.attrs.length > 0 || !node.sourceCodeLocation) continue;
    const url = paragraphUrl(node);
    const card = url && links.get(url);
    if (!card) continue;
    const { startOffset, endOffset } = node.sourceCodeLocation;
    blocks.push(html.slice(offset, startOffset), card);
    offset = endOffset;
  }
  blocks.push(html.slice(offset));
  return blocks;
}
