import { resolve } from 'node:path';
import sharp, { type Metadata } from 'sharp';
import { primitive } from '../styles/design-tokens.json';

export const ogImageSize = { width: 1200, height: 630 };

const fontFamily = 'Rounded-X M+ 1c bold, Bold';
const coreFont = resolve('public/fonts/rounded-x-mplus-1c-bold-core.woff2');
const extendedFont = resolve('public/fonts/rounded-x-mplus-1c-bold-extended.woff2');
const frameColor = `hsl(${primitive['palette-blue-700-hue'].value}, ${primitive['palette-blue-700-saturation'].value}, ${primitive['palette-blue-700-lightness'].value})`;
const ink = '#17212a';
const paper = '#fdfdfd';
const ruleColor = '#dfe7ed';
const frameWidth = 32;
const ruleSpacing = 36;

type Avatar = { top: number; diameter: number; padding: number; border: number };
type Overlay = { input: Buffer; left: number; top: number };
let extendedFontReady: Promise<Metadata> | undefined;

function escapedText(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

async function textImage(text: string, size: number) {
  // Register the extended glyphs as well as the main font for native text rendering.
  extendedFontReady ??= sharp({
    text: { text: '髙', font: fontFamily, fontfile: extendedFont },
  }).metadata();
  await extendedFontReady;

  return sharp({
    text: {
      text: `<span foreground="${ink}">${escapedText(text)}</span>`,
      font: `${fontFamily} ${size}`,
      fontfile: coreFont,
      rgba: true,
    },
  });
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
  };
}

export async function renderOpenGraphImage(text: Overlay[], avatar: Avatar) {
  const { width, height } = ogImageSize;
  const centerX = width / 2;
  const radius = avatar.diameter / 2;
  const rules = Array.from(
    { length: Math.floor((height - frameWidth * 2) / ruleSpacing) },
    (_, index) => {
      const y = frameWidth + (index + 1) * ruleSpacing;
      return `<path d="M${frameWidth} ${y}H${width - frameWidth}"/>`;
    },
  ).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${frameColor}"/>
    <rect x="${frameWidth}" y="${frameWidth}" width="${width - 2 * frameWidth}"
      height="${height - 2 * frameWidth}" fill="${paper}"/>
    <g fill="none" stroke="${ruleColor}" stroke-width="1">${rules}</g>
    <circle cx="${centerX}" cy="${avatar.top + radius}" r="${radius}"
      fill="${paper}" stroke="${frameColor}" stroke-width="${avatar.border}"/>
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
