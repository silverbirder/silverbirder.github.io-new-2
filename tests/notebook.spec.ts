import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { PNG } from 'pngjs';

test.use({
  baseURL: 'http://127.0.0.1:4350',
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
  launchOptions: { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] },
});

async function auditText(page: Page) {
  return page.evaluate(async () => {
    const body = document.querySelector<HTMLElement>('.notebook-body')!;
    const decoration = getComputedStyle(body, '::before');
    const url = decoration.maskImage.match(/url\(["']?(.*?)["']?\)/)![1];
    const source = await (await fetch(url)).text();
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml');
    const path = svg.querySelector('path')!;
    const svgHeight = svg.querySelector('svg')!.viewBox.baseVal.height;
    const step = parseFloat(decoration.maskSize.split(' ')[1]);
    const origin =
      body.getBoundingClientRect().top +
      scrollY +
      parseFloat(decoration.top) +
      parseFloat(decoration.maskPosition.split(' ')[1]) +
      (path.getPointAtLength(0).y / svgHeight) * step;
    const halfStroke = ((parseFloat(path.getAttribute('stroke-width')!) / svgHeight) * step) / 2;
    const ctx = document.createElement('canvas').getContext('2d')!;
    const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
    const violations: {
      kind: string;
      text: string;
      tag: string;
      actual: number[];
      bounds: number[];
    }[] = [];
    let checked = 0;

    function inspect(node: Text) {
      const parent = node.parentElement!;
      const style = getComputedStyle(parent);
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      for (const { segment, index } of segmenter.segment(node.data)) {
        if (!segment.trim()) continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + segment.length);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const top = rect.top + scrollY;
        const rowTop = origin + Math.round((top - origin) / step) * step;
        const rowBottom = rowTop + step;
        const detail = { text: segment, tag: parent.tagName, bounds: [rowTop, rowBottom] };
        if (Math.abs(top - rowTop) > 0.05 || Math.abs(rect.height - step) > 0.05) {
          violations.push({ ...detail, kind: 'selection box', actual: [top, top + rect.height] });
        }
        const metrics = ctx.measureText(segment);
        const baseline = top + metrics.fontBoundingBoxAscent;
        const inkTop = baseline - metrics.actualBoundingBoxAscent;
        const inkBottom = baseline + metrics.actualBoundingBoxDescent;
        if (inkTop < rowTop + halfStroke - 0.05 || inkBottom > rowBottom - halfStroke + 0.05) {
          violations.push({ ...detail, kind: 'glyph ink', actual: [inkTop, inkBottom] });
        }
        checked++;
      }
    }

    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) inspect(node as Text);
    return {
      origin,
      step,
      checked,
      totalViolations: violations.length,
      violations: violations.slice(0, 30),
    };
  });
}

function greenBounds(before: Buffer, buffer: Buffer, color: number[]) {
  const original = PNG.sync.read(before);
  const png = PNG.sync.read(buffer);
  let first = png.height;
  let last = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const offset = (y * png.width + x) * 4;
      const changed = color.some((_, i) => png.data[offset + i] !== original.data[offset + i]);
      if (changed && color.every((channel, i) => Math.abs(png.data[offset + i] - channel) <= 1)) {
        first = Math.min(first, y);
        last = Math.max(last, y);
        break;
      }
    }
  }
  return { first, last };
}

async function auditNativeSelection(
  page: Page,
  selector: string,
  info: TestInfo,
  grid: { origin: number; step: number },
) {
  const target = page.locator(selector).first();
  if (!(await target.count())) return;
  await target.scrollIntoViewIfNeeded();
  const area = await target.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    do {
      node = walker.nextNode();
    } while (node && !node.textContent!.trim());
    if (!node) throw new Error('Selection target has no text');
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, Math.min(node.textContent!.length, 2));
    const rect = range.getBoundingClientRect();
    const body = document.querySelector('.notebook-body')!.getBoundingClientRect();
    const unit = parseFloat(getComputedStyle(element).lineHeight);
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(element, '::selection').backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      documentTop: rect.top + scrollY,
      documentClipTop: Math.max(0, Math.floor(rect.y - unit)) + scrollY,
      dpr: devicePixelRatio,
      clip: {
        x: Math.floor(body.x),
        y: Math.max(0, Math.floor(rect.y - unit)),
        width: Math.floor(body.width),
        height: Math.ceil(unit * 3),
      },
      color: [...ctx.getImageData(0, 0, 1, 1).data],
    };
  });
  const before = await page.screenshot({ clip: area.clip });
  await page.mouse.move(area.x + 0.5, area.y + area.height / 2);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width - 0.5, area.y + area.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(await page.evaluate(() => getSelection()!.toString())).not.toBe('');
  const screenshot = await page.screenshot({ clip: area.clip });
  await info.attach(`selection-${selector}`, { body: screenshot, contentType: 'image/png' });
  const bounds = greenBounds(before, screenshot, area.color);
  expect(bounds.last, 'native selection color must be visible').toBeGreaterThanOrEqual(0);
  const rowTop = grid.origin + Math.round((area.documentTop - grid.origin) / grid.step) * grid.step;
  // Paint edges may be rounded to a device pixel; layout assertions above are stricter.
  const pixel = 1 / area.dpr;
  expect(area.documentClipTop + bounds.first / area.dpr).toBeGreaterThanOrEqual(rowTop - pixel);
  expect(area.documentClipTop + (bounds.last + 1) / area.dpr).toBeLessThanOrEqual(
    rowTop + grid.step + pixel,
  );
  expect((bounds.last - bounds.first + 1) / area.dpr).toBeGreaterThanOrEqual(grid.step - pixel * 2);
  await page.keyboard.press('ArrowRight');
}

async function openArticle(page: Page, route: string, root: number) {
  await page.goto(route);
  await expect(page.locator('.notebook-body')).toBeVisible();
  await page.evaluate(async (size) => {
    document.documentElement.style.fontSize = `${size}px`;
    const body = document.querySelector('.notebook-body')!;
    const fonts = new Set(
      [...body.querySelectorAll('*')].map((element) => {
        const style = getComputedStyle(element);
        return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      }),
    );
    await Promise.all([...fonts].map((font) => document.fonts.load(font, body.textContent!)));
    await document.fonts.ready;
  }, root);
}

const sizes = [
  { name: 'パソコン幅', width: 1280, root: 16 },
  { name: 'スマートフォン幅', width: 375, root: 16 },
  { name: '狭い画面幅', width: 320, root: 16 },
  { name: '文字を1.25倍に拡大', width: 1280, root: 20 },
  { name: '文字を2倍に拡大', width: 1280, root: 32 },
];

for (const size of sizes) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: 900 } });
    for (const { name, route } of [
      { name: '記事サンプル', route: '/samples/notebook/' },
      { name: '実際の記事', route: '/blog/contents/20261101/' },
    ]) {
      test(`${name}の文字と選択背景が罫線内に収まる`, async ({ page }, info) => {
        await openArticle(page, route, size.root);
        const report = await auditText(page);
        await info.attach('ruling-measurements', {
          body: JSON.stringify(report, null, 2),
          contentType: 'application/json',
        });
        expect(report.checked).toBeGreaterThan(0);
        expect(report.violations).toEqual([]);
        for (const selector of ['.notebook-body > p', '.notebook-body h2', 'pre code', 'th']) {
          await auditNativeSelection(page, selector, info, report);
        }
      });
    }
  });
}

test('見出しが大きすぎると文字と選択範囲のはみ出しを検出する', async ({ page }) => {
  await openArticle(page, '/samples/notebook/', 16);
  await page.addStyleTag({ content: '.notebook .notebook-body h2 { font-size: 3rem; }' });
  await page.evaluate(() => document.fonts.ready);
  const report = await auditText(page);
  expect(report.violations.some(({ kind }) => kind === 'glyph ink')).toBe(true);
  expect(report.violations.some(({ kind }) => kind === 'selection box')).toBe(true);
});
