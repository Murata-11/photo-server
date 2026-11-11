# Issue #35：48MP対応への範囲縮小

POの2026-11-11の明示依頼に基づき、HEIC/HEIFの受付とカスタムネイティブ構成を除去する。製品仕様第12節、OpenAPI `createPhoto`、Storybook「Issue 20 / 48MPアップロード」、ADR 0007を参照。

## 確認方法

StorybookのNormalでJPEGを選択し、50MB・6,000万画素の案内と成功表示を確認する。Saving・PixelLimit・Corrupt・Mismatch・Multiple・Unsupported・Busyで処理中と理由別失敗を確認する。HEIC/HEIFは選択を注入しても未対応形式として拒否する。PC 1440×1000・スマートフォン393×852を対象とする。

実APIは専用DBと合成画像で、JPEG/PNG/WebPの8064×6048、60MP上限、50MiB上限、元画像一致、HEIC/HEIF/AVIF拒否、破損・偽装、過負荷と復帰、再起動保持を確認する。既存形式の通常フローと48MPのブラウザー操作を実行する。

既存データの扱いは変更しない。既に保存したHEIC等も生成済みJPEGと元バイトを配信し続ける。本番写真を検証素材に使わず、既存ファイルを削除・変換しない。

## 検証結果

2026-11-11、今回の変更を対象に確認した。

- `pnpm dod-check`：成功（整形、Lint、構造、型、カバレッジ、ビルド、未使用依存、High以上の依存脆弱性チェック）。
- 標準sharpのDockerイメージのビルド：成功。独自のlibvips/libheifビルドは不要。
- `check-upload.mjs`：14シナリオ成功。再起動後の一覧・元画像一致も成功。
- Storybookのアップロード試験：9件成功。レビュー用ページのビルドと検証5件も成功。
- 実APIに接続する48MPブラウザー試験：PC・iPhone 16相当の2件成功。元画像のバイト一致、再読み込み、未対応形式の拒否を確認。
- OpenAPI生成物の再生成差分なし、`git diff --check`成功。

ローカルDocker環境はcgroupのメモリー制限を適用しないため、1GiB制約の検証はCIの48MP Docker integrationで行う。CIでは制約値を検証してから同じ14シナリオと再起動保持を実行する。
