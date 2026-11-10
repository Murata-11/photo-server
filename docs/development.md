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

JPEGフィクスチャを追加し、再読込、アルバム、お気に入り、ダウンロード一致、ゴミ箱・復元、検索をPC・393×852で検証します。生成したデータは専用DB・専用写真ディレクトリにのみ保存してください。Playwrightは既定で`/usr/bin/chromium`を使用し、他環境では`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`で指定します。iOS Safari実機・実際のTailscale通信・本番バックアップ復元は別途検証が必要です。

## Storybook・契約

```sh
pnpm storybook
pnpm storybook:typecheck
pnpm build-storybook
pnpm generate:ui-api
```

Storybookの「アプリ / ひより」「スマートフォン / iPhone 16」で同じAppをMSWに接続して操作できます。Storybookのデータは架空のフィクスチャで、実写真を配置しません。通常起動ではサンプル写真を一覧に混ぜません。

HTTP契約の正は[api/openapi.yaml](../api/openapi.yaml)。型・クライアント・MSWルートはOpenAPIから固定バージョンで生成し、直接編集しません。再生成後に差分がないことを確認します。[レビュー用Pages](review-pages.md)はStorybookとSwagger UIだけを公開し、バックエンド・写真保存領域・DBは配信しません。

製品仕様は[docs/product.md](product.md)、設計は[docs/architecture.md](architecture.md)、DBは[docs/database-design.md](database-design.md)、運用は[docs/operations.md](operations.md)、開発手順は[docs/workflow.md](workflow.md)を参照してください。
