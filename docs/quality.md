# 品質検査

pre-commitとCIで `npm run check` を実行する。コミットせずに試す場合は `sh .husky/_/pre-commit` を実行する。検査は作業ツリー全体を対象とし、自動修正やステージ操作は行わない。

## 準備

Node.js 24以上、npm 11.15以上を使う。`mise install` でactionlintとjqを用意し、`npm ci`、`npm run browser:install` の順に実行する。Linuxではブラウザのシステム依存も必要なため、`npm run browser:install -- --with-deps` を使う。

## 検査対象

| 対象                   | 検査                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------- |
| JS・TS                 | Oxlint、循環的複雑度10以下、認知的複雑度15以下                                          |
| Astro                  | 専用lint、アクセシビリティ、未使用CSS、型検査                                           |
| CSS                    | Stylelint、数値の変数化、未定義の変数参照                                               |
| HTML                   | 生成HTMLの構造                                                                          |
| Markdown               | Markdownlint、Oxfmt                                                                     |
| JSON・YAML・TOML       | Oxfmt、GitHub Actionsはactionlint                                                       |
| package.json・lockfile | npm-package-json-lintによる構文・型・バージョン固定、npm ciによる整合性、npm audit      |
| .npmrc・シェル         | npm configとjqによるレジストリ・7日待機の確認、actionlint、フックの構文                 |
| 未使用・重複           | Knip、PurgeCSS、jscpdの重複率0%                                                         |
| ブラウザ               | 全3ページのWCAG A・AA、コントラスト、200%拡大、幅375・1280、JavaScript無効時の画面移動  |
| 配信サイズ             | Size LimitでクライアントJSは0、CSS合計gzip 10 kB以下、全3ページのHTMLは各gzip 40 kB以下 |
| 速度                   | モバイル条件のLighthouseでLCP 2.5秒以下、CLS 0.1以下、TBT 200ミリ秒以下                 |

複雑度のルールには、違反を検出するテストを設けている。Markdownから使うレイアウトはKnipの入口として登録する。actionlintとjqはmiseで管理する。PurgeCSS CLIの未使用セレクターの一覧はjqで判定する。今の記事に出てこないMarkdown標準要素も利用対象とする。configとassetsの検査に独自JSは使わない。

## 依存パッケージの保護

`.npmrc` でTakumi Guardの匿名プロキシと公開後7日間の待機を使う。認証情報は不要。設定はこのプロジェクトにだけ適用する。新しい版の選択を待機させる設定のため、既存lockfileの古い選択を取り消すものではない。

間接依存のminimatch、KaTeX、RE2JSは脆弱性修正版へoverrideしている。上流の対応後に不要なoverrideを除去する。待機期間の例外は設定しない。

## 結果の扱い

検査記録と確認画像は、Git管理しない `.cache/quality/` に保存する。`docs/images/` には保存しない。Lighthouseは各ページを3回測り、各指標の中央値を判定する。実験環境での測定であり、利用者の実測Core Web VitalsやINPの測定ではない。外部画像・Webフォント・監査APIへの接続に失敗した場合も検査は失敗させる。

参照：[npmの設定](https://docs.npmjs.com/cli/using-npm/config/)、[Takumi Guard](https://shisho.dev/docs/t/guard/quickstart/npm/)、[Oxlint](https://oxc.rs/docs/guide/usage/linter.html)。
