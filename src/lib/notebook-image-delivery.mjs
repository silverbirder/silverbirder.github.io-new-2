import { parseFragment, serialize } from 'parse5';
import tokens from '../styles/design-tokens.json' with { type: 'json' };

const primitive = tokens.primitive;
const readingWidth = primitive['measure-md'].value;
const lineHeight = Number.parseFloat(primitive['line-height-md'].value);
const gutter = `clamp(${primitive['space-4'].value}, ${primitive['space-fluid'].value}, ${primitive['space-8'].value})`;
const availableWidth = `calc(100vw - ${gutter} - ${gutter})`;
const pixelsPerRem = 16;
const maxDensity = primitive['ratio-double'].value;
const deliverySteps = [0.5, 0.75, 1, 1.5, maxDensity];
const cloudinaryAsset =
  /^\/(?<cloud>[A-Za-z0-9_-]+)\/image\/upload\/(?:(?:f_auto|q_auto|c_limit|w_\d+)[,/])*(?<asset>v\d+\/.+)$/u;

function positiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

function dimensions(properties, url) {
  const aspect = url.searchParams.get('ar')?.split(':') ?? [];
  const width = positiveInteger(properties.width) ?? positiveInteger(aspect[0]);
  const height = positiveInteger(properties.height) ?? positiveInteger(aspect[1]);
  return { width, height };
}

function delivery(properties, url, parts) {
  const rows = positiveInteger(properties['data-notebook-rows']);
  const { width, height } = dimensions(properties, url);
  if (!width || !height || (!rows && properties.srcset)) return;

  const imageWidth = rows ? (rows * lineHeight * width) / height : width / pixelsPerRem;
  const maxWidth = Math.min(imageWidth, Number.parseFloat(readingWidth));
  const sourceSize = `min(${maxWidth}rem, ${availableWidth})`;
  const candidate = (factor) =>
    Math.max(1, Math.min(width, Math.ceil(maxWidth * pixelsPerRem * factor)));
  const address = (pixels) =>
    `${url.origin}/${parts.cloud}/image/upload/c_limit,w_${pixels}/q_auto/f_auto/${parts.asset}${url.search}`;
  const widths = [...new Set(deliverySteps.map(candidate))];
  properties.src = address(candidate(1));
  properties.srcset = widths.map((pixels) => `${address(pixels)} ${pixels}w`).join(', ');
  properties.sizes = properties.loading === 'lazy' ? `auto, ${sourceSize}` : sourceSize;
}

function updateImage(properties) {
  if (typeof properties.src !== 'string') return;
  const url = URL.parse(properties.src);
  if (url?.origin !== 'https://res.cloudinary.com') return;
  const parts = cloudinaryAsset.exec(url.pathname)?.groups;
  if (parts) delivery(properties, url, parts);
}

function walk(node) {
  if (node.tagName === 'img') {
    const original = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
    const properties = { ...original };
    updateImage(properties);
    if (properties.src !== original.src) {
      node.attrs = Object.entries(properties).map(([name, value]) => ({ name, value }));
      return true;
    }
  }
  return (node.childNodes ?? []).map(walk).some(Boolean);
}

export default {
  name: 'notebook-image-delivery',
  html(node, context) {
    if (!node.value.includes('res.cloudinary.com')) return;
    const fragment = parseFragment(node.value);
    if (walk(fragment)) context.setField(node, 'value', serialize(fragment));
  },
};
