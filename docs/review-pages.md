# PRレビュー用GitHub Pages

2026-11-10のPOのチャット依頼に基づく。[Issue #10](https://github.com/Murata-11/photo-server/issues/10)。製品アプリとは別の、公開の静的レビュー資料である。仕様の承認・製品実装の完了を意味しない。

## ページ構成

通常のベースURLは `https://murata-11.github.io/photo-server/`。実際のURLはGitHub Pages設定で確認する。

| パス                          | 内容                            |
| ----------------------------- | ------------------------------- |
| `/`                           | 公開中のPR一覧                  |
| `/pr/<番号>/`                 | そのPRのドキュメントトップ      |
| `/pr/<番号>/storybook/`       | Storybook                       |
| `/pr/<番号>/api/`             | Swagger UI                      |
| `/pr/<番号>/api/openapi.yaml` | リポジトリからコピーしたAPI定義 |
| `/pr/<番号>/revision.html`    | 対象PR・コミットSHA             |

トップ・Storybook・APIを同じ成果物として配置する。リンクは相対パスなのでリポジトリ名やPRのサブパスに依存しない。mainの製品仕様ページを別途最新として公開する機能は含まない。

## GitHub側の初期設定

1. このPRをレビュー・マージする。公開側の `workflow_run` はmainに存在する必要があるため、導入PR自身ではPagesへの公開は動かない。
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定する。リポジトリの公開範囲は変更しない。
3. **Settings → Actions → General → Workflow permissions** で、ワークフローからPRコメントを作成できることを確認する。組織のポリシーで書込権限が禁止されている場合は管理者が調整する。
4. `github-pages` environmentのデプロイ許可ブランチにmainを許可する。必要な承認者設定がある場合、公開は承認待ちになる。
5. 同じリポジトリのPRを作成するか、既存PRにコミットをpushする。`review-build` が成功した後、`review-pages` が成功し、PRのBotコメントのリンクから両ページを確認する。

Pages設定APIは作業環境からForbiddenとなったため、現在の有効化状態は未確認。コードの追加だけでは、Pagesの設定完了・実サイトの公開成功とは扱わない。PAT・有料サービスは追加しない。

## ビルドと公開

- `review-build`（`.github/workflows/storybook.yml`）はread-only権限でPRのhead SHAをcheckoutし、固定依存を導入、更新・削除処理のテスト、Storybook型検査・静的ビルド、OpenAPIの構文・参照検証を行う。mainへのpushと手動実行では生成までを確認する。
- PRでは `review-site` artifactを3日間保持する。OpenAPIの正は `api/openapi.yaml` で、閲覧用にコピーする。仕様を別に手書き管理しない。
- `review-pages` は成功したPRビルドを受けて起動する。mainの公開処理だけを実行し、PRのコードやartifactのJSを公開ジョブでは実行しない。同一リポジトリのPRだけを対象とし、既にcloseされたPRや古いSHAの結果は公開しない。forkはビルドのみ。
- 成果物の隠しパス、シンボリックリンク、必須ファイルの欠落、上限超過を拒否し、対象PRのフォルダだけを差し替える。`gh-pages` ブランチは複数PRの成果物の保存用であり、GitHub PagesのSourceには指定しない。force pushはしない。
- Pages全体を一つのartifactとして公式Pages Actionsでデプロイし、成功後にPRの同じBotコメントを更新する。公開処理はリポジトリ全体で直列化する。
- PRのclose時は `pull_request_target` でmainの処理だけを実行し、該当フォルダを削除して再デプロイする。マージでも同じ。Git履歴には過去の静的資料が残るため、秘密情報の削除手段には使わない。

短時間に多数の公開イベントが重なると、GitHubのconcurrency制御で待機中の古い実行が置き換わる場合がある。リンクが付かないPRでは最新の `review-build` を再実行する。

公開失敗は `review-pages` のログで確認する。修正後は失敗ジョブを再実行する。古いSHAなら、PRの最新コミットに対する `review-build` を再実行する。公開設定が整うまで、ビルドのartifactはActionsからダウンロードして確認できる。

## 公開範囲と制約

リポジトリと同じく、閲覧者をPOだけには限定しない。実写真、個人情報、秘密値をStoryやAPI例に含めない。Swagger UIは実行操作と外部validatorを無効化し、UI資産も同梱する。APIの認証・権限や本番アプリの公開設定は変更しない。

PR更新のビルドが失敗した場合、最後に公開成功した版が残る。Botコメントと `revision.html` のSHAを、レビュー対象コミットと照合する。closeから削除の反映にもActions実行・Pages配信の時間がかかる。

既存 `dod-check` はアプリ未実装のため失敗する。その判定を緩めず、レビュー資料の検証・公開を別ワークフローで行う。OpenAPIの互換性検査・実API契約テスト・製品E2Eはこの導入には含まない。

## 導入時の検証記録

2026-11-10、ローカルでfrozen-lockfile導入、`build:review`、公開データの検証・更新・削除テスト3件、既存の構造検査テスト8件、整形、Lint、Knip、actionlint 1.7.7、`git diff --check` が成功。pnpm auditはHigh/Critical 0件、Moderate 1件。

Chromium/Playwrightで `/photo-server/pr/10/` 相当のサブパスからトップ、Storybook、Swagger UIの7操作、YAML取得、Try it out無効を確認。pageerrorと外部リクエストは0件。ローカルのbare Gitリポジトリで初回保存、別PR追加、既存PR削除を実行し、他PRの保持とソースファイル非公開を確認した。

実GitHub Pagesへの公開・PRコメントの更新は未実施。導入PRのマージとGitHub側の設定後に確認する。既存 `dod-check` のアプリ未実装による失敗は解消対象外。Storybookの既知のチャンクサイズ警告とクラウド環境のグローバル設定保存警告は継続する。Swagger UIの推移的依存 `@scarf/scarf` のインストールスクリプトはpnpmの許可リストに追加せず、無効のまま表示できることを確認した。
