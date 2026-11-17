import type { APIRoute, GetStaticPaths, MarkdownInstance } from 'astro';
import postcss from 'postcss';
import designTokens from '../../styles/design-tokens.json';

const tokens = designTokens.primitive;

interface FontProps {
  characters: string;
  boldCharacters: string;
}

export const getStaticPaths: GetStaticPaths = () => {
  const articles = import.meta.glob<MarkdownInstance<{ title: string; publishedAt: string }>>(
    '/src/pages/**/*.md',
    { eager: true },
  );
  return Object.entries(articles).map(([path, article]) => {
    const { title, publishedAt } = article.frontmatter;
    const content = article.rawContent();
    const fontText = `${content.replace(/<[^<>]*>/g, '')}${publishedAt}`;
    const fontBoldText = /\*\*|__|<(?:strong|b)\b/i.test(content)
      ? fontText
      : article
          .getHeadings()
          .map(({ text }) => text)
          .join('');
    // Retain metric glyphs even when an article contains only Japanese headings.
    return {
      params: { article: path.slice('/src/pages/'.length, -'.md'.length) },
      props: {
        characters: [...new Set(` HxNODATE0123456789トップブログ${title}${fontText}`)].join(''),
        boldCharacters: [...new Set(` Hx${title}${fontBoldText}`)].join(''),
      },
    };
  });
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
const googleCss = async (weight: number, characters: string) => {
  const url = new URL('https://fonts.googleapis.com/css2');
  url.searchParams.set('family', `${family}:wght@${weight}`);
  url.searchParams.set('display', 'swap');
  url.searchParams.set('text', characters);
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
