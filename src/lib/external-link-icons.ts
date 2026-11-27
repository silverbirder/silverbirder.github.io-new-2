import { html, parseFragment, type DefaultTreeAdapterTypes as Html } from 'parse5';

const siteHostname = 'silverbirder.github.io';
const externalMark =
  '<span class="external-link-tail" aria-hidden="true"><svg class="external-link-mark" viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round"><path vector-effect="non-scaling-stroke" d="M5.5 2.5h-4v8h8v-4M7.5 1.5h3v3m0-3L5 7"/></svg></span>';

function attribute(element: Html.Element, name: string) {
  return element.attrs.find((attr) => attr.name === name)?.value;
}

function* elements(parent: Html.ParentNode): Generator<Html.Element> {
  for (const child of parent.childNodes) {
    if (!('tagName' in child) || child.namespaceURI !== html.NS.HTML) continue;
    yield child;
    yield* elements(child);
  }
}

function externalHostname(link: Html.Element, page: URL) {
  const href = attribute(link, 'href');
  if (!href) return;
  const url = URL.parse(href, page);
  if (!url || !['http:', 'https:'].includes(url.protocol)) return;
  if (url.hostname === page.hostname || url.hostname === siteHostname) return;
  return url.hostname;
}

function labelLocation(link: Html.Element) {
  const descendants = [...elements(link)];
  const label = descendants.find(
    (element) =>
      attribute(element, 'data-link-label') !== undefined ||
      attribute(element, 'class')?.split(/\s+/u).includes('notebook-photo-caption'),
  );
  if (!label && descendants.some((element) => element.tagName === 'img')) return;
  return (label ?? link).sourceCodeLocation;
}

export function addExternalLinkIcons(markup: string, page: URL) {
  const inserts: { offset: number; content: string }[] = [];
  const fragment = parseFragment(markup, { sourceCodeLocationInfo: true });
  for (const link of elements(fragment)) {
    if (link.tagName !== 'a' || link.childNodes.length === 0) continue;
    const hostname = externalHostname(link, page);
    if (!hostname) continue;

    const location = labelLocation(link);
    if (!location?.startTag || !location.endTag) continue;

    const src = `https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname)}.ico`;
    const favicon = `<img class="external-link-favicon" src="${src}" alt="" width="16" height="16" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
    inserts.push({ offset: location.startTag.endOffset, content: favicon });
    inserts.push({ offset: location.endTag.startOffset, content: externalMark });
  }

  // Keep rendered markup intact, including scripts and whitespace around inline links.
  let position = 0;
  let result = '';
  for (const { offset, content } of inserts) {
    result += markup.slice(position, offset) + content;
    position = offset;
  }
  return result + markup.slice(position);
}
