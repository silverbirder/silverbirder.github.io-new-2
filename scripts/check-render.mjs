import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import lighthouse from 'lighthouse';

const routes = ['/', '/blog/', '/blog/contents/20261101/'];
const reportDirectory = path.resolve('.cache/quality');
const mime = { '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml' };

async function serve(request, response) {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const filename = path.resolve(
    'dist',
    `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`,
  );
  if (!filename.startsWith(`${path.resolve('dist')}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    response.setHeader('Content-Type', mime[path.extname(filename)] ?? 'application/octet-stream');
    response.end(await readFile(filename));
  } catch {
    response.writeHead(404).end();
  }
}

async function checkPage(browser, url, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  assert.equal((await page.goto(url)).status(), 200);
  await page.evaluate(() => document.fonts.ready);
  if (await page.locator('.notebook-body').count()) {
    assert.equal(
      await page
        .locator('.notebook-body')
        .evaluate((element) => getComputedStyle(element).lineHeight),
      '26px',
    );
    const weights = await page.evaluate(() =>
      [...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.weight),
    );
    assert.ok(
      weights.includes('400') && weights.includes('700'),
      'Both Kaisei Opti weights must load',
    );
  }
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(
    results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })),
    [],
    url,
  );
  assert.deepEqual(failures, []);
  assert.equal(
    await page
      .locator('script:not([type="application/ld+json"]):not([type="application/json"])')
      .count(),
    0,
  );
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    `Overflow: ${url}/${width} ${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].filter((element) => element.getBoundingClientRect().right > window.innerWidth).map((element) => ({ tag: element.tagName, class: element.className, width: element.getBoundingClientRect().width, maxWidth: getComputedStyle(element).maxWidth }))))}`,
  );
  await context.close();
}

async function checkNavigation(browser, origin) {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(origin);
  await page.getByRole('link', { name: 'ブログ', exact: true }).first().click();
  await page.locator('main a').click();
  assert.equal(await page.locator('.notebook-body').count(), 1);
  assert.equal(await page.locator('.notebook-body h2').count(), 3);
  for (const image of await page.locator('.notebook-body img').all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((element) => element.decode());
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(reportDirectory, 'article.png'), fullPage: true });
  await context.close();
}

async function measurePerformance(url, index) {
  const samples = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const { lhr } = await lighthouse(url, {
      port: 4359,
      onlyCategories: ['performance'],
      logLevel: 'error',
    });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(
      path.join(reportDirectory, `lighthouse-${index}-${attempt}.json`),
      JSON.stringify(lhr),
    );
    assert.equal(lhr.runtimeError, undefined, `Lighthouse could not complete: ${url}`);
    samples.push(lhr.audits);
  }
  return samples;
}

async function checkPerformance(origin) {
  for (const [index, route] of routes.entries()) {
    const samples = await measurePerformance(`${origin}${route}`, index);
    const limits = {
      'largest-contentful-paint': 2500,
      'cumulative-layout-shift': 0.1,
      'total-blocking-time': 200,
    };
    const values = {};
    for (const [metric, limit] of Object.entries(limits)) {
      const sorted = samples.map((audits) => audits[metric].numericValue).sort((a, b) => a - b);
      values[metric] = sorted[1];
      assert.ok(
        sorted.every(Number.isFinite) && values[metric] <= limit,
        `${route}: median ${metric}=${values[metric]}, samples=${sorted}, limit=${limit}`,
      );
    }
    console.log(
      `${route}: median of 3 LCP=${Math.round(values['largest-contentful-paint'])}ms CLS=${values['cumulative-layout-shift']} TBT=${values['total-blocking-time']}ms`,
    );
  }
}

await mkdir(reportDirectory, { recursive: true });
const server = createServer((request, response) => {
  void serve(request, response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ args: ['--remote-debugging-port=4359'] });
  for (const route of routes) {
    for (const width of [375, 1280]) await checkPage(browser, `${origin}${route}`, width);
  }
  await checkNavigation(browser, origin);
  await checkPerformance(origin);
  console.log(
    'Accessibility, contrast, zoom, navigation and laboratory performance checks passed.',
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
