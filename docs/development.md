# 開発・検証

通常利用の構成・Tailscale設定・デプロイは[README](../README.md)を参照してください。

## Node.jsで直接起動する開発環境

Node.js 24、pnpm 10.34.9を使用します。DBだけ起動する場合もComposeの必須変数を`.env`に設定します。

```sh
pnpm install --frozen-lockfile
docker compose up -d --wait db
pnpm --filter @photo-server/backend migrate
pnpm build
pnpm --filter @photo-server/backend start
```

この起動方法では`.env`の`DATABASE_URL`（接続先`127.0.0.1:5432`）と`PHOTO_DATA_DIR`を使います。`PHOTO_DATA_DIR`はバックエンドworkspace基準です。実データには絶対パスを推奨します。Composeのアプリは接続先を`db`、写真保存先を`/data/photos`に固定するため、この2変数を使用しません。同じ3000番ポートを使うアプリコンテナは事前に停止してください。

UI開発時は別ターミナルで`pnpm --filter @photo-server/frontend dev`を起動できます。この場合は`APP_ORIGIN=http://127.0.0.1:5173`、`DEV_USER`を設定してバックエンドを再起動します。Viteは`/api`をローカルHonoへ転送します。通常起動でMSWは使用しません。

## 検証

バックエンドテストは必ず破棄可能な専用DBに対して実行します。`TEST_DATABASE_URL`に対してテストがTRUNCATEするため、アプリ用・本番用のDBは指定しないでください。CIでは専用PostgreSQLサービスを使用します。

```sh
TEST_DATABASE_URL=postgresql://... pnpm dod-check
pnpm build:review
pnpm check:review
pnpm test:ui
```

通常のVitestテストはUI操作・生成クライアント・モックの契約・認証・CSRF・画像検証・元バイト一致・永続性を確認します。coverageのしきい値は行/文/関数80%、分岐70%です。`test:ui`はStorybookを起動してPC・iPhone向け操作を確認します。

実APIのE2Eは、専用DBを初期化し、`APP_ORIGIN=http://127.0.0.1:3000`、`DEV_USER`を設定してビルド済みサーバーを起動した後、次を実行します。

```sh
pnpm --filter @photo-server/frontend test:app
```

JPEGフィクスチャを追加し、再読込、アルバム、お気に入り、ダウンロード一致、ゴミ箱・復元、検索欄の非表示をPC・393×852で検証します。生成したデータは専用DB・専用写真ディレクトリにのみ保存してください。Playwrightは既定で`/usr/bin/chromium`を使用し、他環境では`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`で指定します。iOS Safari実機・実際のTailscale通信・本番バックアップ復元は別途検証が必要です。

## Storybook・契約

```sh
pnpm storybook
pnpm storybook:typecheck
pnpm build-storybook
pnpm generate:ui-api
```

Storybookの「アプリ / モバイルダーク」で通常起動と同じAppをMSWに接続して操作できます。「アプリ / ひより」と過去IssueのStoryは旧レイアウトの回帰確認用です。Storybookのデータは架空のフィクスチャで、実写真を配置しません。通常起動ではサンプル写真を一覧に混ぜません。

HTTP契約の正は[api/openapi.yaml](../api/openapi.yaml)。型・クライアント・MSWルートはOpenAPIから固定バージョンで生成し、直接編集しません。再生成後に差分がないことを確認します。[レビュー用Pages](review-pages.md)はStorybookとSwagger UIだけを公開し、バックエンド・写真保存領域・DBは配信しません。

製品仕様は[docs/product.md](product.md)、設計は[docs/architecture.md](architecture.md)、DBは[docs/database-design.md](database-design.md)、運用は[docs/operations.md](operations.md)、開発手順は[docs/workflow.md](workflow.md)を参照してください。

## DB移行の検証（Issue #21）

起動時にも `migrate` と同じ履歴付きSQLを適用し、失敗時はHTTPを待ち受けません。参照用のschema.sqlを直接流す方法は使いません。`src/migrations` の適用済みSQLを編集せず、新たな変更は新しい版を追加します。移行SQLはLF改行で管理します。

migrations.test.tsは `TEST_DATABASE_URL` の専用DB内にランダム名のスキーマを作成・削除して、新規／旧DBの移行、排他、再実行、途中失敗、履歴検証と参照DDLとの一致を確認します。テスト用DBの利用者にはスキーマ作成権限が必要です。通常の結合テストはphoto_albums・photos・albumsをTRUNCATEするため、必ず破棄可能なDBを指定してください。実API E2E・復元の結果は[検証記録](issue-21-validation.md)を参照してください。

## 48MPの検証（Issue #35）

通常配布のsharpを使う。HEIC専用のシステムライブラリ、C++ビルド、HEIF_INSPECTORの設定は不要。通常の`pnpm install`・Docker buildで構築できる。

専用DB・専用アプリに対するAPI試験は、リポジトリルートで次を実行する。既定URLはループバック34020で、`UPLOAD_TEST_URL`で変更できる。テストは合成画像を使い、本番へは向けない。

```sh
node apps/backend/scripts/check-upload.mjs
# テスト用アプリを再起動後
node apps/backend/scripts/check-upload.mjs --verify-restart
pnpm --filter @photo-server/frontend test:app
```

PC/スマートフォンの48MP操作も通常の`test:app`へ統合した。Dockerのuploadジョブでは1GiB上限を確認し、48MP JPEG/PNG/WebP、60MP/50MiB境界、HEIC/HEIFの拒否、元バイト一致、過負荷と復帰、再起動保持を試験する。rootless Dockerでcgroupが使えない場合は強制上限下の検証をCIへ委ね、成功と推測しない。

## 写真の一括ゴミ箱移動（Issue #26）

`TEST_DATABASE_URL`の専用DBで実行する既存の結合テストに、一括移動の1/100枚境界、途中失敗の全件ロールバック、入力・認証・冪等性、所属／一括追加／削除／復元とのロック競合を含む。テスト専用トリガーを作成・削除するため、破棄可能DBのDDL権限が必要。

通常の`pnpm --filter @photo-server/frontend test:app`でPC・スマートフォンの一括移動・確認とキャンセル・応答喪失後の再送・枚数／表紙・単一復元・再取得のみの再試行を確認する。実装と検証結果は[Issue #26検証記録](issue-26-validation.md)を参照。
