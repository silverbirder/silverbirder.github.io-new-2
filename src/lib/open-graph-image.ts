import { resolve } from 'node:path';
import { openSync, type Font } from 'fontkit';
import sharp from 'sharp';
import { primitive } from '../styles/design-tokens.json';

export const ogImageSize = { width: 1200, height: 630 };

const fonts = ['core', 'extended'].map((subset) => {
  const font = openSync(resolve(`public/fonts/rounded-x-mplus-1c-bold-${subset}.woff2`));
  if (!('layout' in font)) throw new Error(`Expected a single font in the ${subset} subset`);
  return font;
});
const graphemes = new Intl.Segmenter('ja', { granularity: 'grapheme' });
const blue = `hsl(${primitive['palette-blue-700-hue'].value}, ${primitive['palette-blue-700-saturation'].value}, ${primitive['palette-blue-700-lightness'].value})`;
const cyan = `hsl(${primitive['palette-cyan-200-hue'].value}, ${primitive['palette-cyan-200-saturation'].value}, ${primitive['palette-cyan-200-lightness'].value})`;
const green = `hsl(${primitive['palette-sage-hue'].value}, ${primitive['palette-sage-saturation'].value}, ${primitive['palette-sage-600-lightness'].value})`;
const ink = '#17212a';
const paper = '#fff';
const frameWidth = 32;

type Avatar = { top: number; diameter: number; padding: number; border: number };
type Overlay = { input: Buffer; left: number; top: number; height: number };

function escapedText(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

type TextRun = { text: string; font?: Font };
type DrawnRun = {
  svg: string;
  advance: number;
  bounds: { left: number; top: number; right: number; bottom: number };
};

function fontRuns(text: string) {
  const runs: TextRun[] = [];
  for (const { segment } of graphemes.segment(text)) {
    const font = fonts.find((face) =>
      Array.from(segment).every((character) =>
        face.hasGlyphForCodePoint(character.codePointAt(0)!),
      ),
    );
    const previous = runs.at(-1);
    if (previous && previous.font === font) previous.text += segment;
    else runs.push({ text: segment, font });
  }
  return runs;
}

function drawFontRun(font: Font, text: string, size: number): DrawnRun {
  const { glyphs, positions, bbox, advanceWidth } = font.layout(text);
  const scale = size / font.unitsPerEm;
  let x = 0;
  const svg = glyphs
    .map((glyph, index) => {
      const position = positions[index];
      const path = `<path d="${glyph.path.toSVG()}"
        transform="translate(${x + position.xOffset} ${position.yOffset})"/>`;
      x += position.xAdvance;
      return path;
    })
    .join('');
  return {
    svg: `<g transform="scale(${scale} ${-scale})">${svg}</g>`,
    advance: advanceWidth * scale,
    bounds: {
      left: bbox.minX * scale,
      top: -bbox.maxY * scale,
      right: bbox.maxX * scale,
      bottom: -bbox.minY * scale,
    },
  };
}

async function drawFallbackRun(text: string, size: number): Promise<DrawnRun> {
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${ink}">${escapedText(text)}</span>`,
      font: `sans-serif Bold ${size}`,
      rgba: true,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  const top = -Math.round(info.height * 0.85);
  return {
    svg: `<image x="0" y="${top}" width="${info.width}" height="${info.height}"
      href="data:image/png;base64,${data.toString('base64')}"/>`,
    advance: info.width,
    bounds: { left: 0, top, right: info.width, bottom: top + info.height },
  };
}

async function textImage(text: string, size: number) {
  const runs = await Promise.all(
    fontRuns(text).map(({ font, text: value }) =>
      font ? drawFontRun(font, value, size) : drawFallbackRun(value, size),
    ),
  );
  let advance = 0;
  const placed = runs.map(({ svg, bounds, advance: width }) => {
    const run = {
      svg: `<g transform="translate(${advance} 0)">${svg}</g>`,
      bounds: { ...bounds, left: bounds.left + advance, right: bounds.right + advance },
    };
    advance += width;
    return run;
  });
  const visible = placed.filter(({ bounds }) => bounds.right > bounds.left);
  const left = Math.floor(Math.min(0, ...visible.map(({ bounds }) => bounds.left)));
  const top = Math.floor(Math.min(0, ...visible.map(({ bounds }) => bounds.top)));
  const right = Math.ceil(Math.max(advance, ...visible.map(({ bounds }) => bounds.right)));
  const bottom = Math.ceil(Math.max(0, ...visible.map(({ bounds }) => bounds.bottom)));
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"
    viewBox="${left} ${top} ${width} ${height}">
    <g fill="${ink}">${placed.map(({ svg: run }) => run).join('')}</g>
  </svg>`;
  return sharp(Buffer.from(svg));
}

export async function ogTitleFits(text: string, size: number, maxWidth: number) {
  const metrics = await (await textImage(text, size)).metadata();
  return metrics.width <= maxWidth;
}

export async function centerOgText(text: string, size: number, centerY: number): Promise<Overlay> {
  const { data, info } = await (
    await textImage(text, size)
  )
    .png()
    .toBuffer({ resolveWithObject: true });
  return {
    input: data,
    left: Math.round((ogImageSize.width - info.width) / 2),
    top: Math.round(centerY - info.height / 2),
    height: info.height,
  };
}

export async function renderOpenGraphImage(text: Overlay[], avatar: Avatar) {
  const { width, height } = ogImageSize;
  const centerX = width / 2;
  const radius = avatar.diameter / 2;
  const firstTextTop = Math.min(...text.map(({ top }) => top));
  const lastTextBottom = Math.max(...text.map(({ top, height: textHeight }) => top + textHeight));
  const artGap = 16;
  const topArtMaxHeight = 120;
  const topArtHeight = Math.max(0, Math.min(topArtMaxHeight, firstTextTop - artGap - frameWidth));
  const bottomArtMaxHeight = 172;
  const bottomArtHeight = Math.max(
    0,
    Math.min(bottomArtMaxHeight, height - lastTextBottom - artGap - frameWidth),
  );
  const topArtWidth = 436;
  const bottomArtWidth = 470;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${blue}"/>
    <rect x="${frameWidth}" y="${frameWidth}"
      width="${width - 2 * frameWidth}" height="${height - 2 * frameWidth}" fill="${paper}"/>
    <svg x="${width - frameWidth - topArtWidth}" y="${frameWidth}" width="${topArtWidth}" height="${topArtHeight}"
      viewBox="0 0 ${topArtWidth} ${topArtMaxHeight}" preserveAspectRatio="none"
      fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M151 -9 C182 38 239 76 300 80 C357 84 390 61 437 73"
        stroke="${cyan}" stroke-width="6.4"/>
      <path d="M269 -9 C254 24 276 47 313 62 C351 78 366 108 437 112"
        stroke="${green}" stroke-width="4.5" opacity=".9"/>
    </svg>
    <svg x="${frameWidth}" y="${height - frameWidth - bottomArtHeight}" width="${bottomArtWidth}" height="${bottomArtHeight}"
      viewBox="0 0 ${bottomArtWidth} ${bottomArtMaxHeight}" preserveAspectRatio="none"
      fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-8 146 C43 149 73 123 104 103 C81 98 58 76 70 61 C87 41 111 71 104 103
        C115 78 151 63 161 80 C173 105 131 116 104 103 C124 116 116 138 135 164"
        stroke="${blue}" stroke-width="5"/>
    </svg>
    <circle cx="${centerX}" cy="${avatar.top + radius}" r="${radius}"
      fill="${paper}" stroke="${blue}" stroke-width="${avatar.border}"/>
  </svg>`;

  const profileImage = await sharp('public/silverbirder-avatar.png')
    .resize({ width: avatar.diameter - 2 * avatar.padding })
    .png()
    .toBuffer();
  const png = await sharp(Buffer.from(svg))
    .composite([
      ...text,
      {
        input: profileImage,
        left: centerX - radius + avatar.padding,
        top: avatar.top + avatar.padding,
      },
    ])
    .png()
    .toBuffer();

  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
