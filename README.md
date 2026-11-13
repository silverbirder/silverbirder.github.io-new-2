# ブログの最小実装

[動画・画面・UMLで動作を確認する](docs/review.md)

AstroでHTMLを静的生成します。公開側のReact・SPA・第三者スクリプトは追加していません。デザイン、検索・反応・PWAなどは今後の実装対象です。要件と既存連携の維持方針は `docs/` を参照してください。

CMSから書いて公開する手順・構成図・動作確認は[最小実装の資料](docs/minimum-flow.md)を参照してください。

## 起動・確認

Node.js 24以上で実行します。

```sh
npm ci
npm test
npm run build
npm run preview
```

原稿はコードリポジトリに置かず、CMSから渡す公開用スナップショットを読み込みます。入力ディレクトリが未作成・空でも記事0件でビルドできます。

CLIではAstroの任意のテレメトリーを無効にし、ホームディレクトリへの設定書き込みを不要にしています。

```sh
CONTENT_DIR=/absolute/private/published-posts OUTPUT_DIR=/absolute/private/site npm run build
```

| 変数 | 用途・既定値 |
| --- | --- |
| `CONTENT_DIR` | `.md`を読むディレクトリ。既定はgit管理対象外の`./content` |
| `LINK_CARDS_FILE` | URLをキーとしたカード情報JSON。任意。未収録URLはドメイン名のカードに縮退 |
| `OUTPUT_DIR` | 静的ファイルの出力先。既定は`./dist` |
| `SITE_URL` | canonical・RSS・sitemap用のサイトURL。既定は本番URL |
| `BASE_PATH` | 検証用GitHub Pagesのサブパス。既定は`/` |

ファイル名がslugです。半角英小文字・数字をハイフンでつないだ形式のみ受け付けます。`title`と有効なISO形式の`publishedAt`が必要です。`status: published`かつ公開日時が現在以前の原稿だけを出力し、`index: false`は公開しつつ検索エンジンへnoindexを指定します。非公開記事・未来記事は一覧・ページ・RSS・sitemapのすべてから除外します。

## CMSと共有するAPI

`lib/content.mjs`は次をexportします。

- `validateSlug(slug)`：有効ならslugを返し、不正なら`TypeError`。
- `serializePost(post)`：検証後、frontmatter付きMarkdownを返す。
- `parsePost(markdown, slug)`：検証・正規化した記事を返す。`publishedAt`はISO文字列、`status`の既定値は`draft`。
- `renderMarkdown(body, { cards = {} } = {})`：GFM・HTMLからサニタイズ済みHTMLを返す非同期関数。カードの外部取得は行わない。

CMSのプレビューと公開ページは同じ変換関数を使います。入力は既存の公開用スナップショットで、編集中の原稿や認証情報を`src/`・`public/`・出力ディレクトリに置きません。
