# Issue #51：アルバム削除の仕様レビュー

## 承認と今回の範囲

2026-11-13のチャットでPOが、写真と他所属を保持し、確認後にアルバムだけを削除する方針、およびアルバム復元なしの方針を承認した。[Issue #51](https://github.com/Murata-11/photo-server/issues/51)に記録済み。

基準mainは`f939b64`。本PRはUI・APIの具体的な仕様レビューであり、製品バックエンドの削除処理は未実装。Storyと通常Appで共有するUIを変更するため、通常Appにも削除入口が表示されるが、実APIへの削除はこのPRだけでは成功しない。実装完了・本番反映とは扱わない。仕様PRのマージ・ready・本番反映は別途承認対象。

製品ルールは[product.md](product.md#18-issue-51アルバムの削除仕様レビュー)、HTTP契約は[OpenAPI](../api/openapi.yaml)の`deleteAlbum`を正とする。アルバム名に`/`・`.`・`..`等を含められる既存モデルを考慮して、名前はDELETE `/api/albums`のJSON本文に渡す。生成物は直接編集しない。

## UIレビュー

既存の2つの操作Storyを使用する。メニューにStoryは追加しない。

- スマートフォン：`スマートフォン/iPhone 16` → `iPhone 16で操作する`
- PC：`PC/デスクトップ` → `PCで操作する`

「アルバム」→任意のアルバム→「アルバムを削除」で名前、写真保持、復元不可の説明を確認する。空のアルバムでも利用できる。初期フォーカスはキャンセル。狭い画面では操作ボタンを縦に並べ、横にはみ出さない。削除中はボタン、Escape、背景・閉じる操作による終了を防ぐ。

状態確認用の直リンクはStorybookのiframe URLに以下を指定する。

```text
/iframe.html?id=スマートフォン-iphone-16--playground&viewMode=story&smartphoneCanvas=1&albumDeletion=normal
/iframe.html?id=pc-デスクトップ--playground&viewMode=story&desktopCanvas=1&albumDeletion=normal
```

`albumDeletion`を変更すると、同じ操作Storyで次の状態を確認できる。通常アプリはこの設定を参照せず、MSWを起動しない。

| 値      | 確認する内容                                                               |
| ------- | -------------------------------------------------------------------------- |
| normal  | 確認・キャンセル・削除成功・一覧更新                                       |
| saving  | 処理中、重複実行や閉じる操作の防止                                         |
| error   | 変更なしのエラー。状態確認後も同名があれば再確認して実行                   |
| unknown | モック保存後に応答喪失。状態確認で不存在を確認して完了し、削除は再送しない |
| refresh | 削除成功後に写真一覧の再取得失敗。「再取得」は読取だけを再試行             |

同名再作成を区別するIDは現行モデルにない。削除APIは実行時点の名前を対象とし、無条件リトライを安全とは扱わない。結果不明時に現状を確認し、同名が存在する場合は再作成の可能性を案内し、ユーザーが現在の対象を再確認してから削除する。

## 検証方法

Node.js 24。既存のインストール済み依存を使用し、パッケージやロックファイルは変更しない。環境のpnpm 11はリポジトリ指定の10と異なるため、今回の検証ではローカル実行ファイルを使用した。

```sh
# リポジトリルート
./node_modules/.bin/prettier --check .
./node_modules/.bin/eslint . --max-warnings 0
./node_modules/.bin/tsc --noEmit -p apps/frontend/tsconfig.json
./node_modules/.bin/tsc --noEmit -p apps/frontend/.storybook/tsconfig.json
node scripts/check-structure.mjs
./node_modules/.bin/knip

# apps/frontend
../../node_modules/.bin/vitest run --coverage --config ../../vitest.config.ts --testTimeout 20000
./node_modules/.bin/vite build
./node_modules/.bin/storybook build --output-dir /tmp/issue51-storybook
./node_modules/.bin/playwright test delete-album.spec.ts
```

ブラウザテストでは1440・393・320px、ライト／ダーク、名前確認、キャンセル、写真不変、一覧への復帰、処理中、応答喪失、再取得のみの再試行、空アルバム、キーボード操作を確認する。画像は架空の既存フィクスチャを使い、本番の写真は使用しない。

## 後続実装の検証分担

AIが仕様承認・マージ後、専用の破棄可能なDBと合成画像で実APIを検証する。

- 認証・CSRF・不正JSON・未知フィールド・名前の文字数境界と特殊文字。
- 空／通常写真／ゴミ箱内写真を含むアルバム削除と不存在の204。
- 全写真の元ファイル・表示画像・メタデータ・お気に入り・ゴミ箱状態・他所属の保持。
- トランザクション途中の失敗でアルバムと所属の全件取り消し。
- 既存の個別所属編集・一括追加・写真削除／復元・同名再作成との競合、暗黙再作成なし。
- 削除後の再取得・再起動保持、実APIによるPC・スマートフォンの操作と回帰検証。

DB構造・新規依存・認証方式の変更は予定しない。POのWindows Docker Desktop・実Tailscale・実機Safari確認は本番前に行う。アルバムをユーザー向けに復元する機能は追加せず、本番での復旧が必要な場合は既存の整合バックアップの運用手順に従う。本PRでは本番データ変更なし。

## 実行結果（2026-11-13）

- フロントエンド74件成功、coverageは文85.21%・分岐85.96%・関数80.86%・行86.65%で既存基準を満たした。
- フロントエンド／Storybook型チェック、ESLint全体、Prettier全体、構造チェック、Knip、Viteビルド、Storybook静的ビルド、差分空白検査に成功。Knipの既存設定に関するヒントとStorybookのチャンクサイズ警告は残る。
- OpenAPI型の再生成・整形後の一致と、モック／クライアント再生成の一致を確認した。
- 最初の単体テストは既存App操作1件、再実行では3件が5秒でタイムアウトした。テストソースは変更せず、実行時の`--testTimeout 20000`でcoverageを含む全74件が成功した。
- ブラウザ確認の過程で320pxのキャンセルボタンの切れを発見し、本ダイアログの操作を縦配置に修正した。ボタンの左右端がダイアログ内にあることもテストする。空アルバムのテストは既存の作成ボタン名と作成後の自動遷移に合わせて修正した。
- 構造チェックはサンドボックス内のpnpm子プロセス起動がEPERMとなったため、同一コマンドを制限外で再実行して成功した。
- バックエンドを含む`dod-check`全体、実DB・実APIの削除、iOS Safari実機、本番反映は未実施。仕様PRのUI／モック検証と区別する。
- 最終ブラウザ確認は削除11件＋既存グリッド6件＋元画像表示／ダウンロード2件の計19件。全体実行では18件成功し、320pxライトの1件は生成ファイル更新と同時に画面が初期化されて時間切れとなった。ファイル更新を止めて`playwright test --last-failed`で再実行し、残る1件も成功した。各ケースの最終結果は全19件成功（同一実行で19件成功したとは扱わない）。
- 確認画面のスクリーンショットは`work/delete-album-{320,393,1440}-{light,dark}.png`に保存し、320pxダークのキャンセル文言・ボタンの収まりを目視確認した。
