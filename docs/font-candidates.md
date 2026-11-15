# フォント候補と仮選定

比較番号30のKaisei Optiをnew-2全体に仮適用する。通常400・太字700を読み込み、擬似太字は無効にする。正式採用は未決定。

## 比較した31書体

2026-11-15時点のKobli調査。本文のfont-familyの先頭指定を確認できた3,489ブログを母数に、根拠のある別名を統合して1ブログ1件で集計した。件数は各書体を先頭に指定したブログ数を示す。実際の日本語描画では代替フォントが使われる場合がある。

以下はWebで配信できる日本語フォントで、短い日本語見本と実ファイルによる400・700の描画を確認した。番号は比較画像と対応し、件数の多い順に並べた。

| 番号 | 書体                    | 指定ブログ数 |
| ---: | ----------------------- | -----------: |
|    1 | Noto Sans JP            |          260 |
|    2 | Zen Kaku Gothic New     |           34 |
|    3 | IBM Plex Sans JP        |           27 |
|    4 | Noto Serif JP           |           21 |
|    5 | M PLUS 1p               |           20 |
|    6 | LINE Seed JP            |           19 |
|    7 | BIZ UDPGothic           |           18 |
|    8 | M PLUS Rounded 1c       |           16 |
|    9 | Zen Maru Gothic         |           12 |
|   10 | Gen Interface JP        |           11 |
|   11 | Noto Sans CJK JP        |            8 |
|   12 | Shippori Mincho         |            6 |
|   13 | M PLUS 1                |            5 |
|   14 | Koruri                  |            4 |
|   15 | M PLUS 1 Code           |            4 |
|   16 | M PLUS 2                |            4 |
|   17 | Zen Old Mincho          |            4 |
|   18 | BIZ UDPMincho           |            3 |
|   19 | Mplus 1p                |            3 |
|   20 | Zen Kaku Gothic Antique |            3 |
|   21 | Noto Serif CJK JP       |            2 |
|   22 | Shippori Mincho B1      |            2 |
|   23 | a5ebec Mono             |            1 |
|   24 | Acode                   |            1 |
|   25 | Alibaba Sans JP         |            1 |
|   26 | BIZ UDGothic            |            1 |
|   27 | Gen Jyuu Gothic LP      |            1 |
|   28 | GenJyuuGothic           |            1 |
|   29 | HackGen                 |            1 |
|   30 | Kaisei Opti（仮選定）   |            1 |
|   31 | Murecho                 |            1 |

## 記事で確認した代替表示

検証記事「nishikawaお布団・ヒートテックの季節」（2026-11-01）で、400・700の両方に代替表示を確認した文字を記す。日本語対応の書体でも、使用した配信ファイルにない文字はブラウザーの代替書体で表示される。

| 書体            | 代替表示された文字                 |
| --------------- | ---------------------------------- |
| M PLUS 1 Code   | ！、〜                             |
| a5ebec Mono     | 季、沐、浴、寒、冬、私、悔、呂、泉 |
| Acode           | 沐                                 |
| Alibaba Sans JP | 〜、沐                             |
| GenJyuuGothic   | 〜、沐                             |
| HackGen         | 〜、沐                             |
| Murecho         | 沐                                 |

「〜」はU+301C、「！」はU+FF01。結果は今回使用した配信ファイルに対するもので、書体全体の収録範囲を示すものではない。Kaisei Optiは検証記事の見出し・本文で代替表示がなかった。
