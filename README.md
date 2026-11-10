# photo-server

Tailscaleを使い、許可した2人で写真を共有するプライベートアプリ。2人とも同じ操作権限を持ちます。

現在は仕様・設計と開発運用ルールを整備している段階です。画面設計用の試作を追加しています。本番アプリは未実装です。品質チェック用の依存関係と、pnpm workspacesの設定を導入しています。

## 文書

- [AGENTS.md](AGENTS.md)：AIエージェント向けの入口
- [CONTRACT.md](CONTRACT.md)：POとAIの役割、権限、承認ルール
- [仕様管理](docs/specification-management.md)：Storybook・OpenAPIのSSOTと整合性確認
- [OpenAPI](api/openapi.yaml)：初期API契約のレビュー案（未承認・未実装）
- [製品仕様](docs/product.md)：機能案、受け入れ条件、未決事項
- [開発フロー](docs/workflow.md)：Issue、ブランチ、PR、承認、リリース
- [DB設計](docs/database-design.md)：DBMLによるテーブル・関連・制約とdbdiagram.ioでのレビュー手順（案）
- [システム設計](docs/architecture.md)：構成案と認証・データの境界
- [初期構成の判断案](docs/decisions/0001-initial-architecture.md)：代替案、影響、承認状況
- [運用手順](docs/operations.md)：リリース、監視、バックアップ・復元

構成案と未決事項は、各文書の承認状況を確認してください。

## 開発の始め方

1. CONTRACT.mdと関連仕様を確認します。
2. Issueに目的・範囲・受け入れ条件を記載します。
3. POが必要な仕様・設計を承認し、readyラベルで着手を承認します。
4. 作業ブランチで実装・検証し、PRでレビューします。

Issueの自動監視やAIの自動起動は未設定です。現時点ではチャットで作業を依頼します。

## 開発環境・検証

技術選定と初期実装後に、必要なバージョン、依存関係の導入、環境変数名、サービス起動、テスト・ビルドの正確なコマンドをここへ追記します。秘密値は記載しません。

Node.js 24とpnpm 10.34.9を使用します。構成は `apps/frontend`・`apps/backend` と、将来の共有パッケージ `packages/*` です。

```sh
pnpm install --frozen-lockfile
pnpm run dod-check
```

各workspaceのチェックと判定条件は [品質チェック](docs/dod-check.md) を参照してください。アプリ未実装のため、現時点の全体判定は失敗します。

現在は文書の差分確認に `git diff --check` を使用できます。これはアプリの動作検証ではありません。

GitHub Actionsの `dod-check` を追加しました。設定と検証範囲は [品質チェック](docs/dod-check.md) を参照してください。アプリ未実装のため、現時点の全体判定は失敗します。GitHub側の必須チェック設定と、マージ・本番反映の承認は別途必要です。

### Storybook（開発環境のみ）

ルートで次を実行します。Node.js・pnpmのバージョンは上記と共通です。

```sh
pnpm install --frozen-lockfile
pnpm run storybook
```

`http://127.0.0.1:6006` を開き、**アプリ / ひより / アプリを操作する** を選択します。
Canvasを全画面表示するとアプリ全体を操作できます。開発サーバーはループバック限定です。

```sh
pnpm run storybook:typecheck
pnpm run build-storybook
pnpm run generate:ui-api
pnpm run test:ui
pnpm --filter @photo-server/frontend run dev
```

静的成果物は `apps/frontend/storybook-static/` に生成されます。
写真一覧・詳細・検索・アルバム・お気に入り・写真追加・削除/復元を、MSWによるメモリ内モックで確認できます。
変更は再読み込みで初期化されます。認証・本番の保存と共有は未実装です。
画面設計の試作にReactとshadcn/ui構成を使い、StorybookのアダプターをReact/Viteへ変更しました。
製品への技術採用や未決機能の承認を意味しません。

詳しいレビュー方法・依存関係・検証条件は [画面設計の記録](docs/ui-prototype.md) を参照してください。
`api/openapi.yaml` は既存の製品APIレビュー案を維持します。UI試作のモック契約は `api/ui-prototype.openapi.json` に分離し、本番APIとは扱いません。
`review-build` は従来どおりStorybookと製品OpenAPIを同じレビュー資料へ出力します。

### PRのレビュー用GitHub Pages

[レビュー用ページの運用手順](docs/review-pages.md)を参照してください。
PRごとにトップ・Storybook・Swagger UIを生成し、更新時に差し替え、close時に削除します。
公開リポジトリのGitHub Pagesとして誰でも閲覧できます。写真・秘密値は配置しません。

```sh
pnpm run check:review
pnpm run build:review
python -m http.server 8080 --bind 127.0.0.1 --directory work/review-site
```

`http://127.0.0.1:8080/` が入口です。ローカル生成物は `work/review-site/` にあり、コミットしません。
対象PR・SHAのページは公開ジョブがGitHubの情報から追加します。
Swagger UI 5.34.1を同梱し、`api/openapi.yaml` を相対パスで読み込みます。
OpenAPI検証には `@apidevtools/swagger-parser` 13.1.0を使用します。
外部CDN・オンラインvalidatorには依存せず、Try it outによる実リクエストは無効です。

### OpenAPIレビュー案の検証

OpenAPI 3.1.0の構文・参照検証に `openapi-spec-validator==0.7.2` を使用します。
アプリの依存関係や生成ツールの採用を意味するものではありません。

```sh
python -m venv work/validation-venv
work/validation-venv/bin/pip install openapi-spec-validator==0.7.2
work/validation-venv/bin/python -m openapi_spec_validator api/openapi.yaml
git diff --check
```

`work/` は一時環境用で、コミット対象にしません。
レビューではOpenAPIの `x-pending-decisions` と各操作の説明を確認します。
認証のカスタム表現は設計上の仮置きであり、クライアント生成前に実方式を確定します。
今回の検証では構文・参照検証と差分チェックが成功しました。
サーバー未実装のため、認可・CSRF・永続性・元ファイル一致の動作検証と型生成は未実施です。
