# 写真アプリの画面設計用たたき台

## 依頼と位置づけ

2026-11-10、POからチャットで「Storybook内で画面一覧ではなくアプリそのものを操作したい」「UIはshadcn/ui」「明るい、Googleフォトをイメージしたたたき台を作成」と依頼された。この依頼を、画面設計用の試作とローカル確認への着手指示として記録する。

作業ブランチ: `prototype/storybook-photo-app`。今回はチャットからの試作依頼として進め、初期実装はローカルで行った。続くPOの「PRを作成して」という依頼に基づき、最新mainとの統合・push・PR作成を行う。マージ・本番反映は対象外。

本番技術選定、製品仕様の未決事項、ADR 0001、本番認証・公開・保存方針についての承認ではない。お気に入り、アルバム、検索、ゴミ箱・復元は操作感をレビューするための案であり、正式な機能採用は未決。

## レビュー方法

`pnpm install --frozen-lockfile` 後 `pnpm run storybook` を実行し、「アプリ / ひより / アプリを操作する」を開く。サイドバーを畳むかCanvasを全画面表示すると、アプリ全体を操作できる。

- フォトから写真を開き、前後に移動する。キーボードの左右キー・Escapeも利用できる。
- 詳細からお気に入り、ダウンロード、情報、削除確認を操作する。
- ゴミ箱で削除した写真を開き、復元する。
- 写真名、サンプルの場所、アルバム名で検索する。
- アルバムを作り、写真詳細の情報から所属アルバムを変更する。
- 「写真を追加」でJPEG/PNG/WebPを選ぶ。成功した写真は一覧と詳細へ反映される。
- 写真なし、読み込み失敗、読み込み中はそれぞれ専用Storyから開始する。

表示・操作状態の正は `apps/frontend/src/App.stories.tsx`。これは本番機能の受け入れ完了を意味しない。

## 試作の構成

React、TypeScript、Vite、Tailwind CSS、shadcn/uiの構成に沿ったローカル所有のButton/Dialog（Radix UI、CVA、clsx、tailwind-merge）を使用。依存の具体バージョンは `pnpm-lock.yaml` に固定する。

アプリ用の単一Storyに実際のApp全体をマウントし、React RouterのMemoryRouterで遷移する。単独起動とStorybookはAppを共用し、同じMSWハンドラーがAPIリクエストを処理する。

試作APIの契約案は `api/ui-prototype.openapi.json`（OpenAPI 3.1.0、JSONはYAMLとして有効）。`pnpm run generate:ui-api` で型、クライアント、MSWルートを生成する。生成物はコミット対象で、直接編集しない。`apps/frontend/src/mocks/scenarios.ts` の手書きシナリオがメモリ内のサンプル値と更新を管理する。型は生成した契約に従い、入力の主要な型も検証する。完全なOpenAPI契約検証と本番APIは今後の作業。既存のCIチェックは維持する。

## 制限

- 保存はMSWのメモリ内のみ。再読み込み・Story切替で初期状態に戻る。2人の端末間の共有・永続保存は実装していない。
- アルバム作成は画面状態内、写真の所属変更はモックAPI内で保持する。
- 日時・場所・ユーザー表示は架空のサンプル。アップロード日時も固定値。本物のEXIF抽出や人物認識はない。
- 認証、Tailscale連携、権限制御、本番バックエンドを実装していない。公開デプロイ・マージは行っていない。
- 削除は試作上のゴミ箱移動のみで、完全削除や保持期限を規定しない。
- サンプル写真の出典は `apps/frontend/public/photos/SOURCES.md`。本番で使用する素材の権利確認は別途必要。
- ストレージ使用量など、実データに基づかない数値は表示しない。

## 検証

`pnpm --filter @photo-server/frontend run build` で型検査と単独アプリのビルド、`pnpm run build-storybook` でStorybookの静的ビルド、`pnpm run test:ui` でStorybook内の主要操作をPlaywrightで検証する。テスト内容は `apps/frontend/tests/app.spec.ts` を参照。

Playwrightは既定でこの管理環境の `/usr/bin/chromium` を使う。他環境では `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` を設定するか、Playwrightブラウザーをインストールして設定の実行パス指定を省略する。

自動アクセシビリティ監査、実認証・永続性・2端末の結合テスト、本番APIの契約テスト、本番の結合テストは未実施。CIは既存ワークフローを維持する。

### 実行結果（2026-11-10）

- 型チェックとアプリビルド: 成功。
- Storybook静的ビルド: 成功（Storybook本体のバンドルサイズに警告あり）。
- Playwright操作テスト: 7件成功。主要フロー、検索・アルバム、追加・ダウンロード、空・失敗・読み込み中、390px幅の操作・横はみ出しを確認。
- 共有Chrome: 初期画面の表示を目視確認。
- 開発時のソース再生成によるリロードが初回のモバイルテストに干渉したため、ファイル更新終了後に再実行し、全件成功を確認した。
- `git diff --check`: 成功。

## 最新mainとの統合

PR作成時にmainのpnpm workspace・Storybook・レビューPagesの追加を取り込んだ。コードは `apps/frontend` に集約し、既存の製品API・DB設計・CIと公開範囲は維持する。サンプル画像とMSW workerは相対URLで読み込み、PagesのPRサブパスから操作できるようにする。

### main統合後の検証

- pnpm 10.34.9で依存関係を導入、ロックファイルを更新。
- `pnpm run build:review`：Storybook型検査・静的ビルド・既存製品OpenAPIの検証・レビュー資料生成に成功。
- `pnpm --filter @photo-server/frontend run build`：型検査と単独アプリビルドに成功。
- `pnpm run test:ui`：7件成功。
- PR相当の `/photo-server/pr/prototype/storybook/` で写真表示・詳細遷移・MSWによる更新をPlaywrightで確認。pageerrorは0件。
- `pnpm run check:review`：3件成功。`check:tooling`：8件成功。
- 整形・Lint・Knip：成功。生成されたOpenAPIの未使用型はKnipの対象外、配布物のMSW workerは整形対象外とし、アプリ本体の検査は維持する。
- `pnpm audit --audit-level=high`：終了コード0、High/Criticalなし、Moderate 2件。
- `pnpm run dod-check`：既存のバックエンド未実装を構造検査が検出して停止。全体の合格やカバレッジ達成は主張しない。
- openapi-typescriptはTypeScript 5系のpeer指定のため、ルートのTypeScript 6との警告がある。今回の生成とフロントエンド型検査は成功したが、将来の生成ツール更新時に互換性を再確認する。
- GitHub Actionsの結果と実GitHub Pages公開は、PR作成後の結果を別途確認する。

## iPhone 16向けの画面設計

2026-11-10のPOの追加依頼「スマホ版のモックも作成して。機種はiphone16」に対応。

Storybookの **スマートフォン / iPhone 16 / iPhone 16でアプリを操作する** を開く。393 × 852 CSS px（標準表示の論理解像度）のiframeに既存のAppを表示するため、PCで開いてもモバイル用のmedia queryと固定ナビゲーションが動く。別のモバイルアプリ実装ではなく、共通Appのレスポンシブ表示をレビューする。

- フォト・お気に入り・アルバムの固定下部タブ。ゴミ箱は上部メニューから開く。
- 上部に写真追加ボタンと検索欄。入力の文字サイズは16pxとし、iOSでの入力時の自動拡大を避ける。
- 思い出カードは横スクロール。写真は3列、アルバムは2列。
- 主な操作ボタンと下部タブは高さ44px以上を確保。写真選択のタップ領域も44 × 44px。
- 下部ナビに内容が隠れない余白を確保。safe-area-insetとviewport-fit=coverで実端末の表示領域に配慮。
- ダイアログは画面幅・高さに収め、フォーム、写真詳細、削除確認・復元を共通モックで操作できる。

モバイル追加後、Playwrightの393 × 852・タッチ入力・deviceScaleFactor 3の条件で主要操作と表示幅を検証し、PC版を含む10件すべて成功。PC上の専用Storyでもiframeの実幅393・高さ852を確認。画面のスクリーンショットを確認した。整形・Lint・Knip・Storybook型検査とレビュー資料のビルドも成功。

検証はChromiumによるWeb表示であり、iPhone実機・iOS Safariでは未検証。端末フレームは見た目の補助で、Dynamic Island、Safariのブラウザーバー、キーボード表示、実機のセーフエリアは再現していない。フレーム内部は393 × 852のWebビューポートとして扱う。既存のメモリ内保存・本番未実装の制限は同じ。

## 実APIへの移行（ADR 0003）

POの実装依頼により、通常起動はMSWを解除しHonoへ接続する。Storybookは同じAppを既存フィクスチャで操作する。契約は`api/openapi.yaml`へ統合、アップロードはmultipart、アルバムと利用者取得もAPI経由へ移行した。本文のメモリ限定・通常起動のモック利用は旧試作時点の制限。画面では追加日（UTC）を明示し、実アプリにはサンプル撮影情報・風景カードを混ぜない。起動・検証・未検証の実端末認証はREADMEを参照。

## Issue #41の通常適用

PR #42の承認済みモバイルダークUIをAppの既定値に適用した。表示・操作仕様は「アプリ / モバイルダーク」を参照する。`designPreview={false}` は過去の回帰Story専用で、通常起動に切替操作は設けない。通常アプリのAPI接続・認証・保存は変更しない。承認記録は製品仕様のIssue #41節を参照。
