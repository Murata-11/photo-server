# photo-server

Tailscaleを使い、許可した2人で写真を共有するプライベートアプリ。ReactのPC・iPhone共通UIとHono API、PostgreSQL、元写真のファイル保存を備えます。認証境界と承認記録は[ADR 0003](docs/decisions/0003-hono-implementation.md)、[CONTRACT](CONTRACT.md)を参照してください。

## ローカル起動

Node.js 24、pnpm 10.34.9、Docker Compose v2を使用します。

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# .envのパスワード、DATABASE_URL、APP_ORIGIN、ALLOWED_USERSを設定
# ローカル検証時のみ APP_ORIGIN=http://127.0.0.1:3000 と DEV_USER=許可した1人 を設定
# Tailscaleで使う場合はDEV_USERを必ず削除

docker compose up -d --wait
pnpm --filter @photo-server/backend migrate
pnpm build
pnpm --filter @photo-server/backend start
```

`http://127.0.0.1:3000`で動作します。初期データは空です。写真を追加して利用します。停止はCtrl+C。DBは`docker compose stop`で停止し、`docker compose up -d --wait`で再開します。名前付きvolumeと写真ディレクトリを削除しないでください。`down -v`はデータを破棄するため通常の停止には使いません。

`.env`はコミットしません。`PHOTO_DATA_DIR`はバックエンドworkspace基準で解決するため、実データには十分な容量のある絶対パスを推奨します。既定の`work/photo-data`はGit対象外です。DB接続パスワードはDATABASE_URL内でURLエンコードしてください。DDLは初期作成用で、既存スキーマの変更を移行するものではありません。

UI開発時は別ターミナルで`pnpm --filter @photo-server/frontend dev`を起動できます。この場合は`APP_ORIGIN=http://127.0.0.1:5173`、`DEV_USER`を設定してバックエンドを再起動します。Viteは`/api`をローカルHonoへ転送します。通常起動でMSWは使用しません。

## Tailscaleで使う場合

`DEV_USER`を解除し、`ALLOWED_USERS`に実際の2人のTailscaleログイン名、`APP_ORIGIN`にServeのHTTPSオリジンを設定します。アプリは127.0.0.1:3000のみに待ち受け、Tailscale Serveの転送先を`http://127.0.0.1:3000`にします。Tailscale Funnelを有効にしないでください。PC内の他プロセスを信頼する構成です。インターネットやLANへアプリのポートを直接公開しないでください。適用前に2人の実端末と未許可利用者・タグ付き端末の拒否を確認します。今回のPRで本番設定は変更していません。

写真、元画像、サムネイル、API、静的ファイルを認証します。更新はOriginの完全一致とカスタムヘッダーを要求します。全応答はprivate, no-storeです。元ファイルはバイト列を変更せず保存し、ダウンロード時も同一内容です。JPEG/PNG/WebP、1枚10MiB、静止画像・40メガピクセル以下を扱います。ゴミ箱は期限なし、完全削除はありません。

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

HTTP契約の正は[api/openapi.yaml](api/openapi.yaml)。型・クライアント・MSWルートはOpenAPIから固定バージョンで生成し、直接編集しません。再生成後に差分がないことを確認します。[レビュー用Pages](docs/review-pages.md)はStorybookとSwagger UIだけを公開し、バックエンド・写真保存領域・DBは配信しません。

製品仕様は[docs/product.md](docs/product.md)、設計は[docs/architecture.md](docs/architecture.md)、DBは[docs/database-design.md](docs/database-design.md)、運用は[docs/operations.md](docs/operations.md)、開発手順は[docs/workflow.md](docs/workflow.md)を参照してください。
