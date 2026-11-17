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
    const step = Number.parseFloat(decoration.maskSize.split(' ')[1]);
    const origin =
      body.getBoundingClientRect().top +
      scrollY +
      Number.parseFloat(decoration.top) +
      Number.parseFloat(decoration.maskPosition.split(' ')[1]) +
      (path.getPointAtLength(0).y / svgHeight) * step;
    const halfStroke =
      ((Number.parseFloat(path.getAttribute('stroke-width')!) / svgHeight) * step) / 2;
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
    const unit = Number.parseFloat(getComputedStyle(element).lineHeight);
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

function hasInk(png: PNG, x: number, y: number) {
  const offset = (y * png.width + x) * 4;
  return [0, 1, 2].some((channel) => png.data[offset + channel] < 247);
}

function paintedColumns(png: PNG, top: number, bottom: number) {
  const columns: { left: number; right: number; top: number; bottom: number }[] = [];
  let current: (typeof columns)[number] | undefined;
  for (let x = 0; x < png.width; x++) {
    const rows = [];
    for (let y = top; y <= bottom; y++) {
      if (hasInk(png, x, y)) rows.push(y);
    }
    if (rows.length) {
      current ??= { left: x, right: x, top: bottom, bottom: top };
      current.right = x;
      current.top = Math.min(current.top, rows[0]);
      current.bottom = Math.max(current.bottom, rows.at(-1)!);
    } else if (current) {
      columns.push(current);
      current = undefined;
    }
  }
  if (current) columns.push(current);
  return columns;
}

function horizontalRuleRows(png: PNG, top: number, bottom: number) {
  const rows = [];
  for (let y = top; y <= bottom; y++) {
    let painted = 0;
    for (let x = 0; x < png.width; x++) painted += Number(hasInk(png, x, y));
    if (painted > png.width * 0.9) rows.push(y);
  }
  return rows;
}

async function auditRulingMarks(page: Page, info: TestInfo) {
  const area = await page.evaluate(() => {
    const heading = document.querySelector('.notebook-heading')!;
    const headingBox = heading.getBoundingClientRect();
    const body = document.querySelector('.notebook-body')!;
    const bodyBox = body.getBoundingClientRect();
    const radius = Number.parseFloat(getComputedStyle(body).lineHeight) / 4;
    const y = Math.floor(headingBox.bottom);
    return {
      dpr: devicePixelRatio,
      bodyY: bodyBox.top - y,
      tickHeight: Number.parseFloat(getComputedStyle(heading, '::after').height),
      radius,
      clip: {
        x: Math.floor(bodyBox.left),
        y,
        width: Math.floor(bodyBox.width),
        height: Math.ceil(bodyBox.top - y + radius),
      },
    };
  });
  const screenshot = await page.screenshot({
    clip: area.clip,
    path: info.outputPath('ruling-marks.png'),
  });
  await info.attach('ruling-marks', { body: screenshot, contentType: 'image/png' });
  const png = PNG.sync.read(screenshot);
  const y = Math.round(area.bodyY * area.dpr);
  const radius = Math.floor(area.radius * area.dpr);
  const line = horizontalRuleRows(png, y - radius, y + radius);
  expect(line.length, '最上段の横罫線が描画される').toBeGreaterThan(0);
  const above = paintedColumns(png, y - radius, line[0] - 1);
  const below = paintedColumns(png, line.at(-1)! + 1, y + radius);
  const ticks = paintedColumns(png, area.dpr, Math.floor(area.tickHeight * area.dpr) - 1);
  expect(above.length, '罫線の上側にもドットの丸みが描画される').toBeGreaterThan(3);
  expect(below).toHaveLength(above.length);
  expect(ticks).toHaveLength(above.length);
  for (const [index, dot] of above.entries()) {
    const lower = below[index];
    const tick = ticks[index];
    const center = (dot.left + dot.right) / 2;
    expect(Math.abs(center - (lower.left + lower.right) / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(center - (tick.left + tick.right) / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(line[0] - dot.top - (lower.bottom - line.at(-1)!))).toBeLessThanOrEqual(1);
  }
  const bottomImage = await page.locator('.notebook-bottom').screenshot({
    path: info.outputPath('bottom-marks.png'),
  });
  await info.attach('bottom-marks', { body: bottomImage, contentType: 'image/png' });
  const bottomPng = PNG.sync.read(bottomImage);
  const bottomTicks = paintedColumns(bottomPng, area.dpr, bottomPng.height - 1);
  expect(bottomTicks, '記事下端にも同じ間隔の棒が描画される').toHaveLength(ticks.length);
  for (const [index, tick] of ticks.entries()) {
    const bottomTick = bottomTicks[index];
    expect(
      Math.abs(tick.left + tick.right - bottomTick.left - bottomTick.right),
    ).toBeLessThanOrEqual(2);
  }
  const edgeArea = await page.locator('.notebook-bottom').evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      x: Math.floor(box.left),
      y: box.top - 4,
      width: Math.floor(box.width),
      height: 4,
    };
  });
  const edge = PNG.sync.read(await page.screenshot({ clip: edgeArea }));
  expect(paintedColumns(edge, 0, edge.height - 1), '下端の線の上に半円が残らない').toHaveLength(0);
}

async function auditMetadata(page: Page, info: TestInfo) {
  const rows = await page.locator('.notebook-entry').evaluateAll((entries) => {
    const heading = document.querySelector('.notebook-heading')!;
    const bodyFamily = getComputedStyle(document.querySelector('.notebook-body')!).fontFamily;
    return entries.map((entry, index) => {
      const style = getComputedStyle(entry);
      return {
        line:
          index === 0
            ? entry.getBoundingClientRect().bottom - Number.parseFloat(style.borderBottomWidth)
            : heading.getBoundingClientRect().top,
        color: index === 0 ? style.borderBottomColor : getComputedStyle(heading).borderTopColor,
        labelColor: getComputedStyle(entry.querySelector('.notebook-entry-label')!).color,
        bodyFamily,
        families: [...entry.querySelectorAll('.notebook-entry-text')].map(
          (text) => getComputedStyle(text).fontFamily,
        ),
        textEdges: [...entry.querySelectorAll('.notebook-entry-text')].map(
          (text) => text.getBoundingClientRect().bottom,
        ),
        dots: [...entry.querySelectorAll('.notebook-meta-dot')].map((dot) => ({
          bottom: dot.getBoundingClientRect().bottom,
          width: dot.getBoundingClientRect().width,
          height: dot.getBoundingClientRect().height,
          color: getComputedStyle(dot).backgroundColor,
          rounding: getComputedStyle(dot).borderRadius,
          hidden: dot.getAttribute('aria-hidden'),
        })),
      };
    });
  });
  expect(rows).toHaveLength(2);
  for (const [index, row] of rows.entries()) {
    expect(row.labelColor, 'NO・DATEの色は罫線と同じ').toBe(row.color);
    expect(new Set(row.families), '番号・日付は本文と同じフォント').toEqual(
      new Set([row.bodyFamily]),
    );
    expect(row.textEdges).toHaveLength(index === 0 ? 2 : 4);
    for (const bottom of row.textEdges) expect(Math.abs(bottom - row.line)).toBeLessThan(0.05);
    expect(row.dots).toHaveLength(index + 1);
    for (const dot of row.dots) {
      expect(Math.abs(dot.bottom - row.line)).toBeLessThan(0.05);
      expect(dot.width).toBeGreaterThan(0);
      expect(dot.width).toBeCloseTo(dot.height, 2);
      expect(dot.rounding).toBe('50%');
      expect(dot.color).toBe(row.color);
      expect(dot.hidden).toBe('true');
    }
  }
  await expect(page.locator('time .visually-hidden')).toHaveText('2026年11月1日');
  await expect(page.locator('time .notebook-meta-parts')).toHaveAttribute('aria-hidden', 'true');
  await page
    .locator('.notebook-header')
    .screenshot({ path: info.outputPath('metadata-heading.png') });
  const image = await page.locator('.notebook-meta').screenshot({
    path: info.outputPath('metadata.png'),
  });
  await info.attach('metadata', { body: image, contentType: 'image/png' });
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
    test('番号と日付の文字と正円のドットが下線に接して揃う', async ({ page }, info) => {
      await openArticle(page, '/blog/contents/20261101/', size.root);
      await auditMetadata(page, info);
    });
    test('上下の目印と罫線ドットが揃い、最上段のドットが上下に丸く描画される', async ({
      page,
    }, info) => {
      await openArticle(page, '/samples/notebook/', size.root);
      await auditRulingMarks(page, info);
    });
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
        await auditNativeSelection(page, '.notebook-body > p', info, report);
        await auditNativeSelection(page, '.notebook-body h2', info, report);
        await auditNativeSelection(page, 'pre code', info, report);
        await auditNativeSelection(page, 'th', info, report);
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
