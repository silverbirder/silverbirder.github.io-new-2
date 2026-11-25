---
layout: '../../layouts/ArticleLayout.astro'
title: '記事の表示サンプル'
number: 1
publishedAt: '2026-11-16T00:00:00+09:00'
index: false
---

見出し、本文、リスト、引用、コード、表、画像、埋め込みを一つの記事で見比べるためのサンプルです。各要素の行間、余白、折り返しと、その前後で罫線との位置が揃うかを確認します。

## 本文と文字の装飾

今日は少し肌寒かったので、散歩の前に温かいお茶をいれました。窓辺に置いたノートを開いて、昨日の出来事を短く書き留めます。長い文章が複数行に折り返されたときも、同じ間隔で落ち着いて読み進められるでしょうか。

次の段落です。段落間の空きが一行分になり、文字が罫線の下側に沿って見えるかを確認します。句読点、かぎ括弧「こういう文字」、英数字の `ABC 123` も含めています。

これは**太字の文章**、こちらは*斜体の文章*、そして~~取り消し線の文章~~です。

文中のリンクは[ブログの記事](/blog/contents/20261101/)へ移動します。長いURLが画面からはみ出さないかも確認します。

https://example.com/very/long/article/path/for/checking/how/a/link/wraps/inside/the/notebook/without/overflowing?category=notebook&view=sample

ここで明示的に改行します。<br>
改行後も、罫線との間隔が変わらないかを確認します。

## 見出しの階層

このページのタイトルが見出し1、この行の上が見出し2です。

### 見出し3：少し細かい話

見出しの直後に置いた段落です。見出しと本文で文字の大きさが変わっても、罫線の位置が途切れないかを確認します。

#### 見出し4：補足の話

本文へ戻ったときの読みやすさを確認します。

##### 見出し5：小さな区切り

短い段落を挟みます。

###### 見出し6：最も深い区切り

深い階層の見出しです。

### 長い見出しが複数行に折り返されたときも、文字と罫線が重ならずに読めるかを確認するための例

折り返す見出しの次に置いた本文です。小さい画面でも前後の余白が自然につながるかを見ます。

## 箇条書き

- 短い項目です。
- 長い項目です。二行以上に折り返されたとき、二行目以降の文字の位置と行間が揃うかを確認します。画面を狭くすると違いが分かりやすくなります。
- 入れ子のある項目です。
  - 二段目の項目です。
  - 二段目からさらに深くします。
    - 三段目の項目です。
- 最後の項目は**太字**と`インラインコード`を含みます。

リストが終わった後の本文です。リストの前後で余白が広がりすぎないかを確認します。

### 番号付きリスト

1. 最初の手順です。
2. 次の手順は少し長めに書きます。一つの手順が何行かに折り返されたときに、番号と本文の位置関係が崩れないかを確認します。
   1. 手順の中の手順です。
   2. 二つ目の小さな手順です。
3. 最後の手順です。

### 段落を含むリスト

- 一つ目の項目の最初の段落です。

  同じ項目の中にある二つ目の段落です。段落間の空きと、次の項目との空きを見比べます。

- 二つ目の項目です。

## 引用

> ノートを開いて、今日の出来事を一つだけ書いてみます。引用が複数行に折り返されても、本文と同じ間隔で読めるでしょうか。
>
> 引用の中の二つ目の段落です。
>
> - 引用の中の箇条書きです。
> - もう一つの項目です。
>
> > 引用の中に、さらに引用を入れています。

引用が終わった後の段落です。

## コード

文中の `const message = 'こんにちは';` が周囲の日本語と同じ行に収まるかを確認します。

```javascript
const notes = ['散歩に出かけた', '温かいお茶を飲んだ'];

function summarize(items) {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

console.log(summarize(notes));
```

コードブロックの直後に置いた段落です。ブロックの高さや余白の影響で、ここから罫線との位置がずれていないかを確認します。

### 横に長いコード

```text
This_is_a_deliberately_long_unbroken_line_for_checking_horizontal_scrolling_inside_a_code_block_without_widening_the_entire_article_or_clipping_its_surrounding_text.

空行を挟んだ後の行です。
```

## 表

| 要素   | 確認すること             | 状態   |
| ------ | ------------------------ | ------ |
| 見出し | 文字の大きさと前後の余白 | 確認中 |
| リスト | 入れ子と折り返し         | 確認中 |
| 画像   | 縦横比と表示サイズ       | 確認中 |

表の直後の本文です。表の各行だけでなく、本文へ戻ったときの罫線との位置も確認します。

### 横に広い表

| 項目     | 月曜日         | 火曜日       | 水曜日       | 木曜日       | 金曜日     | 土曜日     | 日曜日       |
| -------- | -------------- | ------------ | ------------ | ------------ | ---------- | ---------- | ------------ |
| 朝の予定 | 散歩と朝ごはん | ノートを書く | 洗濯をする   | 買い物に出る | 本を読む   | 公園に行く | ゆっくり休む |
| 夜の予定 | 夕食を作る     | 映画を見る   | 片付けをする | 手紙を書く   | 早めに寝る | 日記を書く | 翌週の準備   |

## 画像とキャプション

本文の流れを妨げない大きさに抑えた例です。画像を選ぶと元の画像を開きます。写真を切り抜かず、縦横比を保っています。

### 横長の画像

[![開封前の布団のパッケージ。横長の写真。高さ312pxを目安に縮小した例です。](https://res.cloudinary.com/silverbirder/image/upload/f_auto,q_auto,w_768/v1793534296/silver-birder.github.io/blog/mqitxyovnhd6qysojkab.jpg?ar=416%3A312)](https://res.cloudinary.com/silverbirder/image/upload/f_auto,q_auto,w_1280/v1793534296/silver-birder.github.io/blog/mqitxyovnhd6qysojkab.jpg)

画像の次の段落です。画像とキャプションの高さが半端になっても、本文が罫線に戻るかを確認します。

### 縦長の画像

[![星と月の模様がある布団。縦長の写真も同じ高さに抑えた例です。長いキャプションが二行以上に折り返されたときの行間と、本文へ戻る位置も確認します。](https://res.cloudinary.com/silverbirder/image/upload/f_auto,q_auto,w_768/v1793534298/silver-birder.github.io/blog/potg6bbdpvg7uz9d3mvi.jpg?ar=234%3A312)](https://res.cloudinary.com/silverbirder/image/upload/f_auto,q_auto,w_1280/v1793534298/silver-birder.github.io/blog/potg6bbdpvg7uz9d3mvi.jpg)

### 小さな画像

![小さく表示した布団のパッケージ](https://res.cloudinary.com/silverbirder/image/upload/f_auto,q_auto,w_144/v1793534296/silver-birder.github.io/blog/mqitxyovnhd6qysojkab.jpg?ar=144%3A108)

小さめに表示した画像の例です。

## 埋め込み

YouTube

https://www.youtube.com/watch?v=4E1J1un37Rw

CodePen

https://codepen.io/silverbirder/pen/gbYwrOa

X

https://x.com/Ikegami_Ryoichi/status/1788907078305861806

Instagram

https://www.instagram.com/p/DEgz2ltSki8/

Bluesky

https://bsky.app/profile/silverbirder.bsky.social/post/3mlhy3wwajk2t

## 区切り線

ここから話題を切り替えます。

---

区切り線を挟んだ後の本文です。ノートの罫線との見分けや、上下の余白を確認します。

## 最後の段落

一通りの要素を通り過ぎた後も、本文と罫線の位置が揃っているかを確認します。これは完成した装飾の見本ではなく、調整が必要なところを見つけるためのページです。
