import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { PNG } from 'pngjs';

test.use({
  baseURL: 'http://127.0.0.1:4350',
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
  launchOptions: {
    executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox'],
  },
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
      // 写真のキャプションは白い台紙の中に揃える。
      if (parent.closest('.notebook-photo-caption')) return;
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
      headerBottom:
        document.querySelector('.notebook-header')!.getBoundingClientRect().bottom + scrollY,
      firstElementTop: body.firstElementChild!.getBoundingClientRect().top + scrollY,
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
  const area = await target.evaluate((element) => {
    element.scrollIntoView({ block: 'center' });
    element.closest('pre')?.scrollTo({ left: 0 });
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
    const backgrounds: string[] = [];
    for (let parent: Element | null = element; parent; parent = parent.parentElement) {
      backgrounds.unshift(getComputedStyle(parent).backgroundColor);
    }
    for (const background of ['white', ...backgrounds]) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, 1, 1);
    }
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
  // 外部ウィジェットの読み込みに依存せず、記事と代替リンクを検査する。
  await page.route('https://**/*', (request) => request.abort());
  await page.goto(route);
  await expect(page.locator('.notebook-body')).toBeVisible();
  const deferredFont = page.locator('link[href$="/fonts/site.css"][media="print"]');
  await expect(deferredFont).toHaveCount(0);
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

function ruleColor(png: PNG, rows: number[]) {
  const colors = rows.map((y) => {
    const offset = (y * png.width + Math.floor(png.width / 2)) * 4;
    return [...png.data.subarray(offset, offset + 3)];
  });
  return colors.reduce((darkest, color) =>
    color.reduce((sum, value) => sum + value, 0) < darkest.reduce((sum, value) => sum + value, 0)
      ? color
      : darkest,
  );
}

function auditAlternatingMarks(
  png: PNG,
  area: { dpr: number; step: number; leftOffset: number; width: number },
) {
  const line = horizontalRuleRows(png, 0, Math.ceil(area.dpr * 2));
  expect(line.length, '目印の上に横線が描画される').toBeGreaterThan(0);
  const marks = paintedColumns(png, line.at(-1)! + 1, png.height - 1);
  expect(marks, '目印は左から罫線一行分ごとに並ぶ').toHaveLength(
    Math.floor((area.width - area.leftOffset) / area.step),
  );
  const scale = (area.step / 26) * area.dpr;
  // Anti-aliasing can extend each edge by one device pixel, adding two to the painted size.
  const paintTolerance = 2;
  for (const [index, mark] of marks.entries()) {
    const dot = index % 2 === 0;
    const center = (mark.left + mark.right + 1) / 2;
    const expectedCenter = (area.leftOffset + area.step * (index + 1)) * area.dpr;
    expect(
      Math.abs(center - expectedCenter),
      '最初の目印と以降の間隔は罫線一行分',
    ).toBeLessThanOrEqual(area.dpr);
    expect(
      Math.abs(mark.right - mark.left + 1 - (dot ? 1.5 : 0.5) * scale),
      '点と棒の幅は文字拡大に追従する',
    ).toBeLessThanOrEqual(paintTolerance);
    expect(
      Math.abs(mark.bottom - mark.top + 1 - (dot ? 1.5 : 4) * scale),
      '小さい点と細長い棒が交互に並ぶ',
    ).toBeLessThanOrEqual(paintTolerance);
  }
  return { line, marks };
}

async function auditRulingMarks(page: Page, info: TestInfo) {
  const area = await page.evaluate(() => {
    const heading = document.querySelector('.notebook-heading')!;
    const headingBox = heading.getBoundingClientRect();
    const body = document.querySelector('.notebook-body')!;
    const bodyBox = body.getBoundingClientRect();
    const bottom = document.querySelector('.notebook-bottom')!;
    const step = Number.parseFloat(getComputedStyle(body).lineHeight);
    const tickHeight = Number.parseFloat(
      getComputedStyle(heading.parentElement!, '::after').height,
    );
    const lineWidth = Number.parseFloat(getComputedStyle(heading).borderBottomWidth);
    const x = Math.floor(bodyBox.left);
    const y = Math.floor(headingBox.bottom - lineWidth);
    const width = Math.floor(bodyBox.width);
    return {
      dpr: devicePixelRatio,
      step,
      width,
      leftOffset: bodyBox.left - x,
      bodyColor: getComputedStyle(body, '::before').backgroundColor,
      frameColor: getComputedStyle(heading).borderBottomColor,
      bottomColor: getComputedStyle(bottom).borderTopColor,
      headingClip: {
        x,
        y,
        width,
        height: Math.ceil(headingBox.bottom - y + tickHeight + 1),
      },
      bodyClip: {
        x,
        y: Math.floor(bodyBox.top + step - step / 4),
        width,
        height: Math.ceil(step / 2),
      },
    };
  });
  const screenshot = await page.screenshot({
    clip: area.headingClip,
    path: info.outputPath('ruling-marks.png'),
  });
  await info.attach('ruling-marks', { body: screenshot, contentType: 'image/png' });
  const png = PNG.sync.read(screenshot);
  const heading = auditAlternatingMarks(png, area);
  const rulingOnlyStyle = '.notebook-body > * { visibility: hidden; }';
  const bodyImage = await page.screenshot({
    clip: area.bodyClip,
    style: rulingOnlyStyle,
    path: info.outputPath('body-ruling.png'),
  });
  await info.attach('body-ruling', { body: bodyImage, contentType: 'image/png' });
  const bodyPng = PNG.sync.read(bodyImage);
  const line = horizontalRuleRows(bodyPng, 0, bodyPng.height - 1);
  expect(line.length, '本文の二本目の横罫線が描画される').toBeGreaterThan(0);
  expect(paintedColumns(bodyPng, 0, line[0] - 1), '本文罫線の上にドットがない').toHaveLength(0);
  expect(
    paintedColumns(bodyPng, line.at(-1)! + 1, bodyPng.height - 1),
    '本文罫線の下にドットがない',
  ).toHaveLength(0);
  expect(area.bodyColor, '本文罫線と上下の線は別の色').not.toBe(area.frameColor);
  expect(area.bottomColor, '上下の線は同じ色').toBe(area.frameColor);
  expect(ruleColor(bodyPng, line), '描画された本文罫線と上下の線も別の色').not.toEqual(
    ruleColor(png, heading.line),
  );
  const bottomTarget = page.locator('.notebook-bottom');
  await bottomTarget.scrollIntoViewIfNeeded();
  const bottomArea = await bottomTarget.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const lastBlock = element.previousElementSibling!.lastElementChild!;
    const contentGap = box.top - lastBlock.getBoundingClientRect().bottom;
    const x = Math.floor(box.left);
    const y = Math.floor(box.top);
    const width = Math.floor(box.width);
    return {
      width,
      contentGap,
      leftOffset: box.left - x,
      clip: { x, y, width, height: Math.ceil(box.bottom - y + 1) },
      edgeClip: { x, y: box.top - 4, width, height: 4 },
    };
  });
  expect(Math.abs(bottomArea.contentGap), '本文の最後に空行を入れない').toBeLessThan(0.05);
  const bottomImage = await page.screenshot({
    clip: bottomArea.clip,
    path: info.outputPath('bottom-marks.png'),
  });
  await info.attach('bottom-marks', { body: bottomImage, contentType: 'image/png' });
  const bottomPng = PNG.sync.read(bottomImage);
  const bottom = auditAlternatingMarks(bottomPng, { ...area, ...bottomArea });
  expect(ruleColor(bottomPng, bottom.line), '描画された上下の線は同じ色').toEqual(
    ruleColor(png, heading.line),
  );
  for (const [index, mark] of heading.marks.entries()) {
    const lower = bottom.marks[index];
    expect(Math.abs(mark.left + mark.right - lower.left - lower.right)).toBeLessThanOrEqual(2);
    expect(
      Math.abs(mark.bottom - mark.top - lower.bottom + lower.top),
      '上下の点と棒は同じ高さ',
    ).toBeLessThanOrEqual(2);
  }
  const edge = PNG.sync.read(
    await page.screenshot({ clip: bottomArea.edgeClip, style: rulingOnlyStyle }),
  );
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
    test('本文罫線に丸がなく、別色の上下線に点と細い棒が交互に並ぶ', async ({ page }, info) => {
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
        expect(
          Math.abs(report.firstElementTop - report.headerBottom),
          '本文はヘッダー直後の一行目から始まる',
        ).toBeLessThan(0.05);
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

test('記事の概要がある場合だけ説明メタタグに出す', async ({ page }) => {
  await page.goto('/blog/contents/20261101/');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    '本文・罫線の表示と「ノート」の文字を確認します。',
  );
  await page.goto('/samples/notebook/');
  await expect(page.locator('meta[name="description"]')).toHaveCount(0);
});

test('CMSの記事タグがノートの下に表示される', async ({ page }) => {
  await page.goto('/blog/contents/20261101/');
  const tags = page.getByRole('list', { name: 'タグ' });
  await expect(tags.getByRole('listitem')).toHaveText(['こども', '日記']);
  await expect(page.locator('.notebook-body').getByRole('list', { name: 'タグ' })).toHaveCount(0);
  await page.goto('/samples/notebook/');
  await expect(tags).toHaveCount(0);
});
