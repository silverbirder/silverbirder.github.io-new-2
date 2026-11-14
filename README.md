# ページ構成の確認用サイト

トップとブログの2ページを、装飾なしの仮テキストで表示する。

```mermaid
flowchart LR
  Top["トップ /"] --> Blog["ブログ /blog/"]
  Blog --> Top
```

ナビゲーションと本文内のリンクで、2ページを行き来できる。

## 起動

Node.js 22.12以降を使用する。

```sh
npm ci
npm run dev
```

## 静的生成

```sh
npm run build
npm run preview
```

生成先は `dist/`。JavaScriptやCSSを配信せず、通常のリンクでページを遷移する。

記事は表示確認用の仮テキスト。既存記事の移行やCMS連携は含まない。
