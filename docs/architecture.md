# システム設計

初期実装は[ADR 0003](decisions/0003-hono-implementation.md)、WindowsのDocker Desktopへの配置は[ADR 0004](decisions/0004-docker-desktop.md)に従う。

```text
許可された2人 → WindowsのTailscale Serve (HTTPS)
              → Windows 127.0.0.1:3000 → Docker Desktopのアプリコンテナ
                Hono / Node.js 24（コンテナ内0.0.0.0:3000）
                ├ React / Viteの静的配信
                ├ PostgreSQL 17.9 (別コンテナ、db:5432)
                └ PHOTO_STORAGE_PATHのホストフォルダー（元画像とJPEG表示画像）
```

すべてのリクエストで2人のTailscaleログイン名を照合する。PC内の他プロセスを信頼するため、アプリをループバック以外で公開しない。Funnelを使用しない。更新APIはOriginとカスタムヘッダーでCSRFを検証する。DB・ファイルの内部情報を応答に含めない。

UIは既存Appを単独起動・Storybookで共用する。通常起動は実API、StorybookだけMSWを使用する。OpenAPIは`api/openapi.yaml`だけを正とし、型・クライアント・モックルートを生成する。フローとデータ保持は製品仕様、画面状態はStoryを参照。

DBは[DB設計](database-design.md)、起動・検証は[README](../README.md)、運用上の未決事項は[運用手順](operations.md)を参照。Tailscale実端末・本番運用・復元訓練は今回のローカル検証で完了扱いにしない。

## 複数アルバムの実装（Issue #21）

[ADR 0005](decisions/0005-multiple-albums.md)に従い、所属を中間テーブルへ保存する。起動時に履歴付き移行を排他的に実行し、成功後にHTTPの待ち受けを開始する。実APIはOpenAPIの個別追加・解除契約へ適合する。適用・復旧は[運用手順](operations.md#issue-21の更新時)を参照。

## 写真の一括アルバム追加（Issue #22）

OpenAPI `addPhotosAlbum` を実APIに実装する。既存の中間テーブルに所属だけを追加し、DB構造や写真ファイルは変更しない。対象写真をID順に `FOR UPDATE` でロックし、全件の存在・アルバム存在・ゴミ箱状態を確認した同一トランザクション内で一括INSERTする。既存所属は保持し、重複は追加しない。個別所属変更は同じ写真ロック、ゴミ箱移動はUPDATEの行ロックで直列化する。失敗時は全件ロールバックする。応答喪失時も同じ追加を安全に再送できる。
