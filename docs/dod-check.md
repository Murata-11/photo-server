# dod-check

## 導入範囲

2026-11-10のチャットで依頼された、TypeScriptのフロント・バックに対する品質チェックを実装する。GitHub標準Linuxランナーを利用し、自前ランナー、Docker、外部有料サービス、追加の秘密値を必要としない。リポジトリ公開設定は変更しない。

公開リポジトリの標準ランナーは無料。非公開リポジトリは契約の無料枠と課金設定を確認する。成果物の保持期間は7日とする。

現在はアプリコードがないため、チェックの導入完了とアプリの品質合格を区別する。未実装を成功として扱うためのダミーコード・テストは追加しない。

## ローカル実行

Node.js 24（`.nvmrc`）とnpmを使用する。開発依存はpackage.jsonで完全固定し、package-lock.jsonをコミットする。

```sh
npm ci
npm run dod-check
```

| コマンド                       | 合格条件                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`         | Prettier違反0件                                                                                                                  |
| `npm run lint`                 | ESLintの警告・エラー0件。any・非nullアサーション・ts-ignore禁止。ts-expect-errorは10文字以上の理由が必要。テストのonly・skip禁止 |
| `npm run typecheck`            | src/frontendとsrc/backendの実装が存在し、strictなTypeScript検査に成功                                                            |
| `npm run test:coverage`        | src配下のテストが1件以上あり全件成功。行・文・関数80%、分岐70%以上。未実行のソースも計測対象                                     |
| `npm run build`                | TypeScriptコンパイルに成功し、distに出力                                                                                         |
| `npm run check:unused`         | Knipで未使用ファイル・export・依存の検出0件                                                                                      |
| `npm audit --audit-level=high` | 開発依存を含むHigh/Critical検出0件                                                                                               |

カバレッジは全体値を検査する。差分カバレッジは未導入。型宣言・テスト・Storyはカバレッジとアプリ存在確認の対象外。

想定エントリーは `src/frontend/index.ts`（またはtsx）と `src/backend/index.ts`。フレームワーク選定後に、エントリーとビルドコマンドを実構成へ更新する。現在のbuildはTypeScriptのコンパイルであり、ブラウザ用バンドルの生成・動作を保証しない。

CIのsecretsジョブは固定バージョンのGitleaks CLIをGoでインストールし、Git履歴とチェックアウトしたファイルを検査する。ライセンスキーは不要。検出値はredactする。ローカルでもGitleaks v8.24.2を用意して実行できる。

```sh
gitleaks git --redact --no-banner .
gitleaks dir --redact --no-banner .
```

## GitHub Actions

PR、mainへのpush、手動実行で起動する。パスによる除外はしない。同一ブランチの古い実行はキャンセルする。権限はcontents:read、checkoutの認証情報は保持しない。

qualityとsecretsの両方がsuccessの場合だけ、最終ジョブ `dod-check` を成功とする。失敗・スキップ・キャンセルは合格にしない。quality内のコマンドは最初の失敗で終了するため、修正後に再実行する。

GitHubのブランチ保護またはRulesetで、mainへのマージに最終ジョブ `dod-check` の成功を要求する。これはファイル追加だけでは有効にならず、管理者による設定が必要。ワークフローや除外設定の変更もレビュー対象とする。

coverageは生成されていれば対象SHAを含む名前で保存する。テスト実行前に失敗した場合は存在しない。

## 未導入の検証

アプリ・仕様の実装時に、Storybookのビルドと操作テスト、OpenAPIの規約・互換性検査、APIの入力・認可テスト、主要導線のPlaywright E2E、アクセシビリティ検査を追加する。現時点でそれらの合格を保証しない。

実DB・マイグレーション検証、バンドルサイズ、循環依存の境界ルール、期限付き例外管理も未導入。スキャナー検出の自動抑制や閾値の引き下げは行わず、必要なら理由を付けてレビューする。

## 導入時の検証記録

2026-11-10、ローカルで以下を確認。GitHub Actions上での実行は未実施。

- ロックファイルからのインストール、Prettier、ESLint、actionlint、git diff --checkに成功。
- Gitleaks v8.24.2でGit履歴と作業ツリーを検査し、検出0件。
- npm auditはHigh/Critical検出0件で成功。推移的依存にModerateが10件あり、今回の失敗閾値には該当しない。
- アプリ未配置で型検査が失敗し、テスト0件でテスト実行が失敗することを確認。
- リポジトリ外の一時fixtureにフロント・バックのTypeScriptコードとテストを置き、型検査・カバレッジ付きテスト・ビルド・Knipの成功経路を確認。fixtureはアプリ実装には含めない。
