import { glob, readFile } from 'node:fs/promises';
import { parseFragment } from 'parse5';

const hairlineWidth = 0.5;
const notebookRuleWidth = 0.375;
const shapes = new Set(['circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect', 'use']);
const attribute = (element, name) => element.attrs?.find((attr) => attr.name === name)?.value;
const pixels = (value) => Number(value?.replace(/px$/u, ''));

function* strokeWidths(element, stroke = 'none', width = '1') {
  const color = attribute(element, 'stroke') ?? stroke;
  const declaredWidth = attribute(element, 'stroke-width') ?? width;
  if (color !== 'none' && shapes.has(element.tagName)) {
    yield {
      width: declaredWidth,
      fixed: attribute(element, 'vector-effect') === 'non-scaling-stroke',
    };
  }
  for (const child of element.childNodes ?? []) {
    yield* strokeWidths(child, color, declaredWidth);
  }
}

function invalidWidths(svg, expectedWidth) {
  const viewWidth = Number(
    attribute(svg, 'viewBox')
      ?.trim()
      .split(/[\s,]+/u)[2],
  );
  const displayWidth = pixels(attribute(svg, 'width'));
  const scale = viewWidth && displayWidth ? displayWidth / viewWidth : 1;
  const invalid = new Set();
  for (const { width, fixed } of strokeWidths(svg)) {
    const effective = pixels(width) * (fixed ? 1 : scale);
    if (effective === 0 || Math.abs(effective - expectedWidth) < 0.000001) continue;
    invalid.add(width);
  }
  return invalid;
}

const tokenFile = 'src/styles/design-tokens.json';
const tokens = JSON.parse(await readFile(tokenFile, 'utf8'));
if (tokens.semantic?.['border-width-hairline']?.value !== `${hairlineWidth}px`) {
  console.error(`${tokenFile}: border-width-hairline を ${hairlineWidth}px にしてください。`);
  process.exitCode = 1;
}

for await (const file of glob(['src/**/*.astro', 'src/**/*.svg', 'public/**/*.svg'])) {
  const expectedWidth = file === 'public/notebook-rule.svg' ? notebookRuleWidth : hairlineWidth;
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/<svg\b[\s\S]*?<\/svg>/gu)) {
    const svg = parseFragment(match[0]).childNodes[0];
    const invalid = invalidWidths(svg, expectedWidth);
    if (!invalid.size) continue;
    const line = source.slice(0, match.index).split('\n').length;
    console.error(
      `${file}:${line}: SVG の線幅 ${[...invalid].join(', ')} は表示上 ${expectedWidth}px になりません。`,
    );
    process.exitCode = 1;
  }
}
