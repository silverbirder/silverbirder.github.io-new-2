import { defaultTreeAdapter, html, parseFragment, serialize } from 'parse5';
import tokens from '../styles/design-tokens.json' with { type: 'json' };

const primitive = tokens.primitive;
const photoWidth = Number.parseFloat(tokens.component['notebook-photo-width'].value);
const frameClass = 'notebook-photo-frame';
const frameClasses = [frameClass, 'notebook-sticker'];
const captionClass = 'notebook-photo-caption';
const frameInset = primitive['space-2'].value;
const lineHeight = Number.parseFloat(primitive['line-height-md'].value);
const gutter = `clamp(${primitive['space-4'].value}, ${primitive['space-fluid'].value}, ${primitive['space-8'].value})`;
const availableWidth = `calc(100vw - ${gutter} - ${gutter} - ${primitive['space-2'].value} - 2 * ${frameInset})`;
const pixelsPerRem = 16;
const maxDensity = primitive['ratio-double'].value;
const deliverySteps = [0.5, 0.75, 1, 1.125, 1.5, maxDensity];
const firstImageGroups = new WeakMap();
const cloudinaryAsset =
  /^\/(?<cloud>[A-Za-z0-9_-]+)\/image\/upload\/(?:(?:f_auto|q_auto|c_limit|w_\d+)[,/])*(?<asset>v\d+\/.+)$/u;

function positiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

function dimensions(properties, url) {
  const aspect = url.searchParams.get('ar')?.split(':') ?? [];
  return {
    width: positiveInteger(properties.width) ?? positiveInteger(aspect[0]),
    height: positiveInteger(properties.height) ?? positiveInteger(aspect[1]),
  };
}

function delivery(properties, url, parts) {
  const { width, height } = properties;
  const rows = positiveInteger(properties['data-notebook-rows']);
  if (!rows && properties.srcSet) return;

  const imageWidth = rows ? (rows * lineHeight * width) / height : width / pixelsPerRem;
  const maxWidth = Math.min(imageWidth, photoWidth);
  const sourceSize = `min(${maxWidth}rem, ${availableWidth})`;
  const candidate = (factor) =>
    Math.max(1, Math.min(width, Math.ceil(maxWidth * pixelsPerRem * factor)));
  const address = (pixels) =>
    `${url.origin}/${parts.cloud}/image/upload/c_limit,w_${pixels}/q_auto/f_auto/${parts.asset}${url.search}`;
  const widths = [...new Set(deliverySteps.map(candidate))];
  properties.src = address(candidate(1));
  properties.srcSet = widths.map((pixels) => `${address(pixels)} ${pixels}w`).join(', ');
  properties.sizes = properties.loading === 'lazy' ? `auto, ${sourceSize}` : sourceSize;
}

function assignPriority(properties, data, group) {
  if (!firstImageGroups.has(data)) firstImageGroups.set(data, group);
  const first = firstImageGroups.get(data) === group;
  properties.loading ??= first ? 'eager' : 'lazy';
  if (first && properties.loading !== 'lazy') properties.fetchPriority ??= 'high';
}
function imageProperties(original, data, group) {
  const url = typeof original.src === 'string' && URL.parse(original.src);
  if (!url || url.origin !== 'https://res.cloudinary.com') return;
  const parts = cloudinaryAsset.exec(url.pathname)?.groups;
  if (!parts) return;
  const dimensionsInPixels = dimensions(original, url);
  if (!(dimensionsInPixels.width && dimensionsInPixels.height)) return;
  const properties = { ...original, ...dimensionsInPixels };
  assignPriority(properties, data, group);
  delivery(properties, url, parts);
  return properties;
}
const hastPropertyNames = { srcset: 'srcSet', fetchpriority: 'fetchPriority' };

function captionText(alt) {
  return typeof alt === 'string' ? alt.trim() : '';
}

function frameHtmlImage(image, caption) {
  const parent = image.parentNode;
  if (
    parent.attrs?.some(
      ({ name, value }) => name === 'class' && value.split(/\s+/u).includes(frameClass),
    )
  ) {
    return false;
  }

  const frame = defaultTreeAdapter.createElement('span', html.NS.HTML, [
    { name: 'class', value: frameClasses.join(' ') },
  ]);
  defaultTreeAdapter.insertBefore(parent, frame, image);
  defaultTreeAdapter.detachNode(image);
  defaultTreeAdapter.appendChild(frame, image);
  if (caption) {
    const label = defaultTreeAdapter.createElement('span', html.NS.HTML, [
      { name: 'class', value: captionClass },
      { name: 'aria-hidden', value: 'true' },
    ]);
    defaultTreeAdapter.insertText(label, caption);
    defaultTreeAdapter.appendChild(frame, label);
  }
  return true;
}

function walk(node, data, group) {
  if (node.tagName !== 'img') {
    return [...(node.childNodes ?? [])].map((child) => walk(child, data, group)).some(Boolean);
  }

  const original = Object.fromEntries(
    node.attrs.map(({ name, value }) => [hastPropertyNames[name] ?? name, value]),
  );
  const properties = imageProperties(original, data, group);
  if (properties) {
    node.attrs = Object.entries(properties).map(([name, value]) => ({
      name: name.toLowerCase(),
      value: String(value),
    }));
  }

  const image = node.parentNode.tagName === 'picture' ? node.parentNode : node;
  return frameHtmlImage(image, captionText(original.alt)) || Boolean(properties);
}

export default {
  name: 'notebook-image-delivery',
  element: {
    filter: ['img'],
    visit(node, context) {
      const parent = context.parent(node);
      const properties = imageProperties(node.properties, context.data, parent ?? node);
      for (const [key, value] of Object.entries(properties ?? {})) {
        if (value !== node.properties[key]) context.setProperty(node, key, value);
      }
      const caption = captionText(node.properties.alt);
      context.wrapNode(parent?.tagName === 'picture' ? parent : node, {
        type: 'element',
        tagName: 'span',
        properties: { className: frameClasses },
        children: caption
          ? [
              {
                type: 'element',
                tagName: 'span',
                properties: { className: [captionClass], ariaHidden: 'true' },
                children: [{ type: 'text', value: caption }],
              },
            ]
          : [],
      });
    },
  },
  raw(node, context) {
    if (!/<img[\s/>]/iu.test(node.value)) return;
    const fragment = parseFragment(node.value);
    if (walk(fragment, context.data, node)) context.setField(node, 'value', serialize(fragment));
  },
};
