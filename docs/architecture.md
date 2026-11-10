# システム設計

初期実装は[ADR 0003](decisions/0003-hono-implementation.md)、WindowsのDocker Desktopへの配置は[ADR 0004](decisions/0004-docker-desktop.md)に従う。

```text
許可された2人 → WindowsのTailscale Serve (HTTPS)
              → Windows 127.0.0.1:3000 → Docker Desktopのアプリコンテナ
                Hono / Node.js 24（コンテナ内0.0.0.0:3000）
                ├ React / Viteの静的配信
                ├ PostgreSQL 17.9 (別コンテナ、db:5432)
                └ photo-files volume（元画像とJPEG表示画像）
```

すべてのリクエストで2人のTailscaleログイン名を照合する。PC内の他プロセスを信頼するため、アプリをループバック以外で公開しない。Funnelを使用しない。更新APIはOriginとカスタムヘッダーでCSRFを検証する。DB・ファイルの内部情報を応答に含めない。

UIは既存Appを単独起動・Storybookで共用する。通常起動は実API、StorybookだけMSWを使用する。OpenAPIは`api/openapi.yaml`だけを正とし、型・クライアント・モックルートを生成する。フローとデータ保持は製品仕様、画面状態はStoryを参照。

DBは[DB設計](database-design.md)、起動・検証は[README](../README.md)、運用上の未決事項は[運用手順](operations.md)を参照。Tailscale実端末・本番運用・復元訓練は今回のローカル検証で完了扱いにしない。
