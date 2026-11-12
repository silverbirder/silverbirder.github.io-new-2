# 現行連携の調査と移行条件

確認日: 2026-11-12

対象は [silverbirder.github.io の main](https://github.com/silverbirder/silverbirder.github.io/tree/54f14a4550505a09c1bef67e7449f2f90e295d55)、コミット `54f14a4550505a09c1bef67e7449f2f90e295d55`。調査時点のmainがこのコミットであることを確認した。

以下はコード・設定の調査結果。本番のアカウント、Secretsの登録状態、実データの受信・配送は未確認。[要件資料](requirements.md)の維持・削除方針を基準にする。

## 1. 維持する計測・所有権・Webmention

| 対象 | 現行で確認したこと | 移行時に残すもの |
| --- | --- | --- |
| Google Analytics（GA） | [全体レイアウト][layout]で `GA_ID` がある場合に `GoogleAnalytics` を設置 | 既存の計測先、全ページへの設置、ビルド時のID設定。独自イベントの配線は未確認 |
| Microsoft Clarity | [全体レイアウト][layout]から呼び出し、[Clarity][clarity]で `Clarity.init(projectId)`。`NEXT_PUBLIC_CLARITY_PROJECT_ID` 設定時に有効 | 既存プロジェクトへの継続計測 |
| Google Search Console | [所有権確認用HTML][verification]を `public` に配置 | `/google104dc4a90e5158de.html` のURLと内容。Search Console API連携は確認していない |
| Webmention | [全体レイアウト][layout]で `rel="webmention"` により `https://webmention.io/silverbirder.github.io/webmention` を宣言 | 受信先と本番の記事URL。webmention.ioへの受信委譲を維持する |
| 本人確認リンク | [全体レイアウト][layout]でGitHubプロフィールへの `rel="me"` | GitHubとの本人確認の関連付け |

GAとClarityのIDは、[GitHub Pagesのワークフロー][deploy]でSecretsからビルドへ渡し、[Turborepoの環境変数設定][env]にも列挙されている。`.env.example` だけを見て移行すると、この設定を落とすおそれがある。IDの実際の値はこの資料には記載しない。

Webmentionは、[既存の記事][webmention]でも「受信はwebmention.io、送信は別サービスのこぶりー」と説明されている。ブログ内の受信一覧表示・自動送信・Bridgy・IndieAuthエンドポイント・microformatsの実装は確認できなかった。これらを既存機能として扱わない。いいね・コメントのDBとは独立している。

## 2. 維持するその他の機能と連携

機能を維持する。Cloudinary・GitHub PR・Gistなどの実装方式を継続採用するかは、要件資料に従って比較する。

| 対象 | 現行実装・根拠 | 移行条件 |
| --- | --- | --- |
| SEO・OGP | [全体metadata][metadata]、[記事metadataとBlogPosting JSON-LD][article]、[記事別OGP生成][ogp] | 既存URL、canonical、記事情報、`index:false` のrobots指定、記事別OGPを維持 |
| sitemap・robots・RSS | [sitemap][sitemap]、[robots][robots]、[RSS][rss]を静的生成。[URL生成][urls]はサイトURLとbasePathを共通利用 | URLと参照関係を維持。下書きを含めない。現行RSSはタイトル・概要・記事URLで、本文全文は含まない |
| いいね・コメント | [いいねUI][likeui]・[コメントUI][commentui]から `NEXT_PUBLIC_LIKES_API_URL` のAPIを利用。[DBスキーマ][schema]に保存 | 記事slug、既存の反応データ、匿名ID、本人によるコメント削除、APIのCORSを引き継ぐ |
| Slack通知 | [いいねAPI][likes]・[コメントAPI][comments]で `SLACK_WEBHOOK_URL` 設定時に送信。いいね・解除・コメント投稿・削除が対象 | 設定時の通知を維持。WebmentionのSlack通知とは別の機能 |
| CMS認証 | [Better Auth設定][auth]でGitHub OAuth、[環境変数][adminenv]にGitHubクライアント設定・許可メールアドレス | 許可ユーザーだけが利用できる認証。非公開原稿と管理APIのアクセス制御を確認 |
| 画像 | [画像loader][loader]と公開記事がCloudinary URLを利用。CMSは[アップローダー][cloudinary]を呼び、[環境変数][adminenv]で設定 | 既存の画像URL・表示・最適化を維持。新規素材の保存先は未決定 |
| 記事公開・下書き移送 | [編集処理][editor]、[記事PR作成][pr]、[GitHub処理][github]がGitHub PR・Gistを利用 | 公開前の確認、下書きの再開・端末間移送を維持。PR・Gistの継続採用は未決定 |
| 要約生成・リンク補完 | [要約処理][summary]はMarkdown除去と先頭120文字の抽出。[リンク補完][linktitles]は外部ページのタイトルを取得 | 要約生成・リンクタイトル補完を維持。要約は外部AIの呼び出しではない |
| 埋め込み・リンクカード | [本文表示][mdx]がSNS・動画などの表示部品を使用 | X・Bluesky・Instagram・YouTube・CodePenの既存埋め込み、リンクカードを維持 |
| 共有・フォロー・OFUSE | [記事詳細][postarticle]でX・Bluesky・はてなブックマーク・端末共有、著者フォロー、OFUSEへの導線を接続 | 各共有先・プロフィール・支援先と操作を維持。はてなブログへの外部投稿とは区別 |
| 問い合わせ・機能要望 | [ホーム][top]にGoogle Formsと `fequest.vercel.app/9` への導線 | 既存の問い合わせ・機能要望の送り先を維持 |
| 著者・本・サービス・写真 | [自己紹介][me]などにプロフィール、成果物、写真ギャラリーへの導線 | 既存の紹介・外部リンクを維持し、要件の案内カードと合わせて配置を検討 |

反応データはPostgresに保存する実装だが、本番DBの提供会社や契約はコードだけでは断定しない。Slack、Cloudinary、GitHubなどへの本番疎通も今回の調査では実行していない。

[ブラウザ保存][storage]の `likes`、`comments:anon-id`、`read-posts` と、CMSの `silverbirder-admin-post-drafts` を移行対象に含める。匿名IDが変わると、以前のいいねの解除・自分のコメント削除に影響する。Gistは手動の退避先で、復元後に対象Gistを削除する実装。

現行のCloudinary画像変換は表示時の処理。アップロード前の横幅1280pxへの縮小・圧縮は新要件で、現行実装済みとは扱わない。

## 3. 置き換える・削除する対象

| 対象 | 方針 |
| --- | --- |
| follow.it | 購読リンク・ボタン・所有権確認metaを別方式へ置き換える。メール購読自体は維持し、日本語の購読・配信体験を追加する |
| ZennへのPR作成 | 削除対象 |
| はてなブログへの下書き投稿 | 削除対象。はてなブックマークへの共有は維持 |
| ホームのタイムライン | 削除対象。自己紹介の職歴は維持 |

ニュースレター配信とGoogle Photos連携は新要件で、現行の実装済み連携ではない。メールはButtondownのAPIを利用し、毎朝、前日分（日本時間）の公開記事を1通にまとめて送る方針。対象記事がなければ送らない。詳細は[要件資料](requirements.md)のメール配信方針を参照する。有料購読やSubstackへの移行を確定要件には含めない。

## 4. 移行後に確認すること

以下は確認項目で、実行済みの結果ではない。

1. 既存の記事URL・canonical・OGP・構造化データ・RSS・sitemapが継続し、非公開原稿を含めない。
2. Search Consoleの所有権確認ファイルへ従来のURLでアクセスできる。
3. 公開ビルドへGAとClarityの既存IDを渡し、実サービスでページ閲覧が記録される。
4. Webmentionの受信宣言とGitHubの本人確認リンクが全ページにあり、既存受信先へ通知が届く。
5. 既存のいいね・コメントが同じ記事に表示され、追加・解除・本人削除と設定時のSlack通知が動く。
6. CMSの認証・画像・下書き保存・公開確認と、SNS埋め込み・共有・フォロー・支援・問い合わせの導線が動く。
7. 日本語で購読登録・登録確認・記事受信・配信停止ができる。前日の複数記事が翌朝1通にまとまり、記事がない日は配信されず、同じ日次配信が重複しない。メール内容と朝の送信時刻は決定後に確認する。

[layout]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/user/src/app/layout.tsx
[clarity]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/user/src/app/clarity.tsx
[deploy]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/.github/workflows/gh-pages.yml
[env]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/turbo.json
[verification]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/user/public/google104dc4a90e5158de.html
[metadata]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/packages/metadata/src/index.ts
[article]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/user/src/app/blog/contents/%5Bslug%5D/page.tsx
[ogp]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/user/src/app/blog/contents/%5Bslug%5D/opengraph-image.png/route.tsx
[urls]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/packages/util/src/site/site.ts
[sitemap]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/user/src/app/sitemap.ts
[robots]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/user/src/app/robots.ts
[rss]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/user/src/app/rss.xml/route.ts
[webmention]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/packages/content/posts/20260908.md
[likes]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/api/src/app/api/likes/route.ts
[comments]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/api/src/app/api/comments/route.ts
[schema]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/api/src/db/schema.ts
[likeui]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/packages/ui/src/domain/notebook-like.tsx
[commentui]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/packages/ui/src/domain/notebook-comments.tsx
[adminenv]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/admin/src/env.js
[auth]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/admin/src/server/better-auth/config.ts
[postarticle]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/packages/user-feature-post-article/src/post-article.tsx
[top]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/packages/user-feature-top/src/top.tsx
[me]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/packages/user-feature-me/src/me.tsx
[mdx]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/packages/ui/src/domain/mdx-components.tsx
[summary]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/packages/admin-feature-post-editor/src/libs/summary.ts
[loader]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/user/src/image-loader.js
[editor]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/packages/admin-feature-post-editor/src/post-editor.presenter.ts
[cloudinary]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/admin/src/server/api/routers/cloudinary.ts
[pr]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/admin/src/app/actions/create-post-pull-request.ts
[github]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/admin/src/server/api/routers/github.ts
[storage]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/packages/user-local-storage/src/index.ts
[linktitles]: https://github.com/silverbirder/silverbirder.github.io/blob/54f14a4550505a09c1bef67e7449f2f90e295d55/apps/admin/src/app/actions/resolve-link-titles.ts
