# dod-check

## 導入範囲

2026-11-10のチャットで依頼された、TypeScriptのフロント・バックに対する品質チェックを実装する。GitHub標準Linuxランナーを利用し、自前ランナー、Docker、外部有料サービス、追加の秘密値を必要としない。リポジトリ公開設定は変更しない。

公開リポジトリの標準ランナーは無料。非公開リポジトリは契約の無料枠と課金設定を確認する。成果物の保持期間は7日とする。

現在はアプリコードがないため、チェックの導入完了とアプリの品質合格を区別する。未実装を成功として扱うためのダミーコード・テストは追加しない。

## ローカル実行

Node.js 24（`.nvmrc`）とpnpm 10.34.9（`packageManager`）を使用する。開発依存はpackage.jsonで完全固定し、`pnpm-lock.yaml` をコミットする。pnpmは `npm install --global pnpm@10.34.9` などで用意する。依存関係の導入・更新はpnpmに統一する。

```sh
pnpm install --frozen-lockfile
pnpm run dod-check
```

## workspace構成

```text
apps/frontend/       # @photo-server/frontend
apps/backend/        # @photo-server/backend
packages/*/          # 将来の共有パッケージ。現時点では未作成
```

`pnpm-workspace.yaml` で対象を定義する。各workspaceは自身の依存関係を宣言し、内部依存には `workspace:*` を使う。チェックツールはルートの開発依存で共有する。アプリのmanifestと設定だけを配置しており、実装・ダミーテストは追加していない。

| コマンド                        | 合格条件                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm run format:check`         | 全体のPrettier違反0件                                                                                                                |
| `pnpm run lint`                 | 全体のESLint警告・エラー0件。any・非nullアサーション・ts-ignore禁止。ts-expect-errorは10文字以上の理由が必要。テストのonly・skip禁止 |
| `pnpm run check:tooling`        | workspace構造検査の回帰テストが全件成功                                                                                              |
| `pnpm run check:structure`      | pnpmが両アプリをworkspaceとして認識し、全workspaceに必須スクリプトと実装コードが存在                                                 |
| `pnpm run typecheck`            | 構造検査後、全workspaceのstrict型検査に成功                                                                                          |
| `pnpm run test:coverage`        | 構造検査後、各workspaceのテストが1件以上あり全件成功。各workspaceで行・文・関数80%、分岐70%以上                                      |
| `pnpm run build`                | 構造検査後、全workspaceのビルドに成功                                                                                                |
| `pnpm run check:unused`         | Knipで未使用ファイル・export・依存の検出0件                                                                                          |
| `pnpm audit --audit-level=high` | 開発依存を含むHigh/Critical検出0件                                                                                                   |

全workspaceに `typecheck`、`test:coverage`、`build` を必須とする。再帰実行に `--if-present` を使用せず、構造検査で欠落を検出する。pnpmの依存順で実行し、最初の失敗で停止する。個別実行例は `pnpm --filter @photo-server/frontend run typecheck`。

型設定はルートの `tsconfig.base.json` を共有し、ブラウザ用とNode.js用の設定は各アプリに分ける。想定エントリーは `apps/frontend/src/index.ts`（またはtsx）と `apps/backend/src/index.ts`。フレームワーク選定後にエントリーとビルドコマンドを実構成へ更新する。現在のbuildは各workspaceのTypeScriptコンパイルであり、ブラウザ用バンドルの生成・動作を保証しない。

カバレッジは各workspace全体で判定する。差分カバレッジは未導入。型宣言・テスト・Storyはカバレッジと実装存在確認の対象外。共通のVitest設定を各workspaceの作業ディレクトリで使用し、coverageとdistは各workspace内に出力する。

pnpmの依存ビルドスクリプトは `onlyBuiltDependencies` の明示リストで管理する。依存追加時に必要なスクリプトだけをレビューして許可する。

CIのsecretsジョブは固定バージョンのGitleaks CLIをGoでインストールし、Git履歴とチェックアウトしたファイルを検査する。ライセンスキーは不要。検出値はredactする。ローカルでもGitleaks v8.24.2を用意して実行できる。

```sh
gitleaks git --redact --no-banner .
gitleaks dir --redact --no-banner .
```

## GitHub Actions

PR、mainへのpush、手動実行で起動する。pnpm/action-setupがpackageManagerの固定バージョンを導入し、setup-nodeはpnpmストアをキャッシュする。依存導入は `pnpm install --frozen-lockfile` とする。パスによる除外はしない。同一ブランチの古い実行はキャンセルする。権限はcontents:read、checkoutの認証情報は保持しない。

qualityとsecretsの両方がsuccessの場合だけ、最終ジョブ `dod-check` を成功とする。失敗・スキップ・キャンセルは合格にしない。quality内のコマンドは最初の失敗で終了するため、修正後に再実行する。

GitHubのブランチ保護またはRulesetで、mainへのマージに最終ジョブ `dod-check` の成功を要求する。これはファイル追加だけでは有効にならず、管理者による設定が必要。ワークフローや除外設定の変更もレビュー対象とする。

各workspaceのcoverageは生成されていれば対象SHAを含む名前で保存する。テスト実行前に失敗した場合は存在しない。

## 未導入の検証

アプリ・仕様の実装時に、Storybookのビルドと操作テスト、OpenAPIの規約・互換性検査、APIの入力・認可テスト、主要導線のPlaywright E2E、アクセシビリティ検査を追加する。現時点でそれらの合格を保証しない。

実DB・マイグレーション検証、バンドルサイズ、循環依存の境界ルール、期限付き例外管理も未導入。スキャナー検出の自動抑制や閾値の引き下げは行わず、必要なら理由を付けてレビューする。

## npm構成での初回検証記録

2026-11-10、ローカルで以下を確認。GitHub Actions上での実行は未実施。

- ロックファイルからのインストール、Prettier、ESLint、actionlint、git diff --checkに成功。
- Gitleaks v8.24.2でGit履歴と作業ツリーを検査し、検出0件。
- npm auditはHigh/Critical検出0件で成功。推移的依存にModerateが10件あり、今回の失敗閾値には該当しない。
- アプリ未配置で型検査が失敗し、テスト0件でテスト実行が失敗することを確認。
- リポジトリ外の一時fixtureにフロント・バックのTypeScriptコードとテストを置き、型検査・カバレッジ付きテスト・ビルド・Knipの成功経路を確認。fixtureはアプリ実装には含めない。

## pnpm移行

2026-11-10のチャット依頼に基づき、pnpm workspacesを採用し、既存PR #7を更新する。アプリの公開範囲・フレームワーク・製品の振る舞いは変更しない。npmのロックファイルをpnpmへ移行し、既存ツールの固定バージョンを維持する。

移行時のローカル検証：

- pnpm 10.34.9のfrozen-lockfileインストール、Prettier、ESLint、actionlint、構造検査の回帰テスト8件が成功。
- 一時fixtureで、両workspaceへの再帰型検査・テスト・ビルドとKnipが成功。カバレッジはworkspace別に生成。
- 実リポジトリでは、アプリ未配置による構造検査失敗と、個別workspaceのテスト0件による失敗を確認。
- pnpm auditはHigh/Critical 0件、Moderate 1件（ツールごとの集計方式が異なるためnpmの件数とは直接比較しない）。
- GitHub Actions上のpnpm構成の結果はPR #7のChecksを参照する。
