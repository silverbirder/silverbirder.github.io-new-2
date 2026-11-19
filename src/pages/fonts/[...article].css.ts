import type { APIRoute, GetStaticPaths, MarkdownInstance } from 'astro';
import { getCollection, render } from 'astro:content';
import postcss from 'postcss';
import { fontProps } from '../../lib/article-font-characters';
import { articleSlug } from '../../lib/article-slug';
import designTokens from '../../styles/design-tokens.json';

const tokens = designTokens.primitive;

interface FontProps {
  characters?: string;
  boldCharacters?: string;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const articles = import.meta.glob<MarkdownInstance<{ title: string; publishedAt: string }>>(
    '/src/pages/**/*.md',
    { eager: true },
  );
  const published = await getCollection('published');
  return [
    { params: { article: 'archive' }, props: {} },
    ...Object.entries(articles).map(([path, article]) => ({
      params: { article: path.slice('/src/pages/'.length, -'.md'.length) },
      props: fontProps(
        article.rawContent(),
        article.frontmatter.title,
        article.frontmatter.publishedAt,
        article
          .getHeadings()
          .map(({ text }) => text)
          .join(''),
      ),
    })),
    ...(await Promise.all(
      published.map(async (article) => {
        const { headings } = await render(article);
        return {
          params: { article: `blog/contents/${articleSlug(article.id)}` },
          props: fontProps(
            article.body ?? '',
            article.data.title,
            article.data.publishedAt,
            headings.map(({ text }) => text).join(''),
          ),
        };
      }),
    )),
  ];
};

const bodySize = Number.parseFloat(tokens['font-size-md'].value);
const headingSize = Number.parseFloat(tokens['font-size-lg'].value);
const lineHeight = Number.parseFloat(tokens['line-height-md'].value);
const descent = Number.parseFloat(tokens['font-descent-md'].value);
const family = tokens['font-family-kaisei-opti'].value[0];
const headingFamily = tokens['font-family-kaisei-opti-heading'].value[0];

// Font-face descriptors cannot resolve CSS custom properties. Generate them
// at build time from the same tokens that define font sizes and ruling height.
const withMetrics = (source: string, name: string, size: number) => {
  const css = postcss.parse(source);
  css.walkAtRules('font-face', (face) => {
    face.walkDecls('font-family', (decl) => {
      decl.value = JSON.stringify(name);
    });
    face.append({ prop: 'ascent-override', value: `${((lineHeight - descent) / size) * 100}%` });
    face.append({ prop: 'descent-override', value: `${(descent / size) * 100}%` });
    face.append({ prop: 'line-gap-override', value: `${tokens['font-line-gap-percent'].value}%` });
  });
  return css.toString();
};
const googleCss = async (weight: number, characters?: string) => {
  const url = new URL('https://fonts.googleapis.com/css2');
  url.searchParams.set('family', `${family}:wght@${weight}`);
  url.searchParams.set('display', 'swap');
  if (characters) url.searchParams.set('text', characters);
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Google Fonts CSS request failed: ${response.status}`);
  return response.text();
};

export const GET: APIRoute<FontProps> = async ({ props }) => {
  const [regular, bold] = await Promise.all([
    googleCss(tokens['font-weight-regular'].value, props.characters),
    googleCss(tokens['font-weight-bold'].value, props.boldCharacters),
  ]);
  const css = [
    withMetrics(regular, family, bodySize),
    withMetrics(bold, family, bodySize),
    withMetrics(bold, headingFamily, headingSize),
  ].join('\n');
  return new Response(css, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
};
