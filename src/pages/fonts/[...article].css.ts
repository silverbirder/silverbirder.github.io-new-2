import type { APIRoute, GetStaticPaths } from 'astro';
import postcss from 'postcss';
import designTokens from '../../styles/design-tokens.json';
import ranges from '../../styles/rounded-x-mplus-ranges.json';

export const getStaticPaths: GetStaticPaths = () => [{ params: { article: 'site' } }];

const tokens = designTokens.primitive;
const bodySize = Number.parseFloat(tokens['font-size-md'].value);
const headingSize = Number.parseFloat(tokens['font-size-lg'].value);
const lineHeight = Number.parseFloat(tokens['line-height-md'].value);
const descent = Number.parseFloat(tokens['font-descent-md'].value);
const family = tokens['font-family-rounded-x-mplus'].value[0];
const headingFamily = tokens['font-family-rounded-x-mplus-heading'].value[0];

function fontFace(
  name: string,
  size: number,
  weight: number,
  file: keyof typeof ranges,
  subset: keyof typeof ranges.regular,
) {
  const rule = postcss.atRule({ name: 'font-face' });
  const descriptors = {
    'font-family': name,
    'font-weight': String(weight),
    'font-display': 'swap',
    src: `url("./rounded-x-mplus-1c-${file}-${subset}.woff2") format("woff2")`,
    'unicode-range': ranges[file][subset],
    'ascent-override': `${((lineHeight - descent) / size) * 100}%`,
    'descent-override': `${(descent / size) * 100}%`,
    'line-gap-override': `${tokens['font-line-gap-percent'].value}%`,
  };
  for (const [prop, value] of Object.entries(descriptors)) rule.append({ prop, value });
  return rule;
}

export const GET: APIRoute = () => {
  const regular = tokens['font-weight-regular'].value;
  const bold = tokens['font-weight-bold'].value;
  const css = postcss
    .root()
    .append(
      ...(['core', 'extended'] as const).flatMap((subset) => [
        fontFace(family, bodySize, regular, 'regular', subset),
        fontFace(family, bodySize, bold, 'bold', subset),
        fontFace(headingFamily, headingSize, bold, 'bold', subset),
      ]),
    );
  return new Response(css.toString(), { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
};
