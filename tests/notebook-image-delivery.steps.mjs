import assert from 'node:assert/strict';
import { Given, Then, When } from '@cucumber/cucumber';
import notebookImageDelivery from '../src/lib/notebook-image-delivery.mjs';

Given('元の幅1280ピクセル、高さ960ピクセルの画像を罫線6行に指定する', function () {
  this.image = {
    value:
      '<p><img src="https://res.cloudinary.com/example/image/upload/f_auto,q_auto,c_limit,w_1280/v1/image.jpg" data-notebook-rows="6" width="1280" height="960" loading="lazy" /></p>',
  };
});

When('記事の配信画像を生成する', function () {
  notebookImageDelivery.html(this.image, {
    setField(node, field, value) {
      node[field] = value;
    },
  });
});

Then('幅208ピクセルと2倍密度向けの幅416ピクセルを選べる', function () {
  const { value } = this.image;
  assert.match(value, /src="[^"]+\/c_limit,w_208\/q_auto\/f_auto\//u);
  assert.match(value, /w_416\/q_auto\/f_auto\/v1\/image\.jpg 416w/u);
  assert.doesNotMatch(value, /w_1280/u);
  assert.match(value, /sizes="auto, min\(13rem,/u);
  assert.match(value, /data-notebook-rows="6"/u);
});
