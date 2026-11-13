import matter from 'gray-matter';
import * as yaml from 'js-yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';

export function validateSlug(slug) {
  if (typeof slug !== 'string' || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new TypeError('slugは半角英小文字・数字をハイフンでつないで指定してください。');
  }
  return slug;
}

function isoDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.test(value)) {
    throw new TypeError('publishedAtには有効なISO日付を指定してください。');
  }
  const day = value.slice(0, 10);
  const calendar = new Date(`${day}T00:00:00Z`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day) {
    throw new TypeError('publishedAtには実在する日付を指定してください。');
  }
  return parsed.toISOString();
}

function strings(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new TypeError(`${field}は空でない文字列の配列にしてください。`);
  }
  return [...new Set(value.map((item) => item.trim()))];
}

function normalizePost(value, slug) {
  validateSlug(slug);
  if (typeof value.title !== 'string' || !value.title.trim()) throw new TypeError('titleは必須です。');
  if (value.summary !== undefined && typeof value.summary !== 'string') throw new TypeError('summaryは文字列にしてください。');
  if (value.body !== undefined && typeof value.body !== 'string') throw new TypeError('bodyは文字列にしてください。');
  const status = value.status ?? 'draft';
  if (!['draft', 'published'].includes(status)) throw new TypeError('statusはdraftまたはpublishedにしてください。');
  if (value.index !== undefined && typeof value.index !== 'boolean') throw new TypeError('indexは真偽値にしてください。');
  return {
    slug,
    title: value.title.trim(),
    summary: value.summary ?? '',
    body: value.body ?? '',
    publishedAt: isoDate(value.publishedAt),
    tags: strings(value.tags, 'tags'),
    keywords: strings(value.keywords, 'keywords'),
    index: value.index !== false,
    status,
  };
}

export function parsePost(markdown, slug) {
  if (typeof markdown !== 'string') throw new TypeError('Markdownは文字列にしてください。');
  // Keep ISO dates as strings so YAML cannot normalize invalid calendar dates first.
  const { data, content } = matter(markdown, { engines: { yaml: (source) => yaml.load(source, { schema: yaml.JSON_SCHEMA }) } });
  return normalizePost({ ...data, body: content }, slug);
}

export function serializePost(value) {
  const { slug, body, ...frontmatter } = normalizePost(value, value.slug);
  return matter.stringify(body, frontmatter);
}

function httpUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}

const element = (tagName, children = [], properties = {}) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });

function linkCards({ cards }) {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'p' || node.children.length !== 1) return;
      const anchor = node.children[0];
      if (anchor.type !== 'element' || anchor.tagName !== 'a' || anchor.children.length !== 1 || anchor.children[0].type !== 'text') return;
      const source = anchor.properties.href;
      const url = httpUrl(source);
      if (!url || anchor.children[0].value !== source) return;
      url.hash = '';
      const snapshot = Object.hasOwn(cards, url.href) ? cards[url.href] : undefined;
      const card = snapshot && typeof snapshot === 'object' ? snapshot : {};
      const title = typeof card.title === 'string' && card.title.trim() ? card.title : url.hostname;
      const children = [element('a', [element('strong', [text(title)])], { href: source })];
      const favicon = httpUrl(card.faviconSrc ?? card.favicon);
      if (favicon) children.push(element('img', [], { src: favicon.href, alt: '', width: 16, height: 16, loading: 'lazy', decoding: 'async' }));
      if (typeof card.description === 'string' && card.description) children.push(element('p', [text(card.description)]));
      const image = httpUrl(card.thumbnailSrc ?? card.image ?? card.imageUrl);
      if (image) children.push(element('img', [], { src: image.href, alt: '', loading: 'lazy', decoding: 'async' }));
      children.push(element('small', [text(url.hostname)]));
      node.tagName = 'aside';
      node.properties = { className: ['link-card'] };
      node.children = children;
    });
  };
}

const schema = {
  ...defaultSchema,
  tagNames: [...defaultSchema.tagNames, 'aside', 'figure', 'figcaption', 'small'],
  attributes: {
    ...defaultSchema.attributes,
    aside: [['className', 'link-card']],
    img: [...(defaultSchema.attributes.img ?? []), 'loading', 'decoding', 'width', 'height'],
  },
  protocols: { ...defaultSchema.protocols, href: ['http', 'https', 'mailto'], src: ['http', 'https'] },
};

export async function renderMarkdown(body, { cards = {} } = {}) {
  if (typeof body !== 'string') throw new TypeError('bodyは文字列にしてください。');
  if (!cards || typeof cards !== 'object' || Array.isArray(cards)) throw new TypeError('cardsはURLをキーにしたオブジェクトにしてください。');
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(linkCards, { cards })
    .use(rehypeSanitize, schema)
    .use(rehypeStringify)
    .process(body);
  return String(result);
}
