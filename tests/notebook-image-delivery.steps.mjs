import assert from 'node:assert/strict';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { Given, Then, When } from '@cucumber/cucumber';
import notebookImageDelivery from '../src/lib/notebook-image-delivery.mjs';

const source = 'https://res.cloudinary.com/example/image/upload/v1/image.jpg';
const processor = await createSatteriMarkdownProcessor({
  syntaxHighlight: false,
  hastPlugins: [notebookImageDelivery],
});

Given('元の幅1280ピクセル、高さ960ピクセルの画像を罫線6行に指定する', function () {
  this.markdown = `<p><img src="${source}" data-notebook-rows="6" width="1280" height="960" loading="lazy" /></p>`;
});

When('記事の配信画像を生成する', async function () {
  this.html = (await processor.render(this.markdown)).code;
});

Then('幅208ピクセルと2倍密度向けの幅416ピクセルを選べる', function () {
  assert.match(this.html, /src="[^"]+\/c_limit,w_208\/q_auto\/f_auto\//u);
  assert.match(this.html, /w_416\/q_auto\/f_auto\/v1\/image\.jpg 416w/u);
  assert.doesNotMatch(this.html, /w_1280/u);
  assert.match(this.html, /sizes="auto, min\(13rem,/u);
  assert.match(this.html, /data-notebook-rows="6"/u);
});

Given('Markdownで縦横比が分かる画像を二つの段落に挿入する', function () {
  this.markdown = `![1枚目](${source}?ar=1280%3A960)\n\n![2枚目][photo]\n\n[photo]: ${source}?ar=960%3A1280`;
});

Then('画像の表示場所が確保され、最初の段落の画像を先に読み込む', function () {
  const [first, later] = this.html.match(/<img\b[^>]*>/gu) ?? [];
  assert.match(first, /width="1280" height="960"/u);
  assert.match(first, /loading="eager" fetchpriority="high"/u);
  assert.match(first, /srcset=/u);
  assert.match(later, /width="960" height="1280"/u);
  assert.match(later, /loading="lazy"/u);
  assert.doesNotMatch(later, /fetchpriority=/u);
});
