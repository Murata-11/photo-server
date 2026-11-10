# photo-server

Tailscaleを使い、許可した2人で写真を共有するプライベートアプリ。2人とも同じ操作権限を持ちます。

現在は仕様・設計の検討段階です。Storybook内でアプリ全体を操作できる画面設計用の試作を追加しています。本番アプリ・認証・永続保存は未実装です。

## 文書

- [AGENTS.md](AGENTS.md)：AIエージェント向けの入口
- [CONTRACT.md](CONTRACT.md)：POとAIの役割、権限、承認ルール
- [仕様管理](docs/specification-management.md)：Storybook・OpenAPIのSSOTと整合性確認
- [製品仕様](docs/product.md)：機能案、受け入れ条件、未決事項
- [開発フロー](docs/workflow.md)：Issue、ブランチ、PR、承認、リリース
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

## 画面設計用プロトタイプ

明るい写真共有アプリ「ひより」の操作案です。詳細と試作の範囲は [画面設計の記録](docs/ui-prototype.md) を参照してください。

Node.js 22.12以降を使用します（検証環境: Node.js 24.22.1 / npm 11.9.0）。

```bash
npm ci
npm run storybook
```

http://localhost:6006 を開き、**アプリ → ひより → アプリを操作する** を選びます。Canvasの全画面表示でも利用できます。

単独アプリの起動は `npm run dev`（http://localhost:5173）。単独起動でもMSWが動き、実バックエンドへ接続しません。

```bash
npm run generate:api    # OpenAPIから型・クライアント・MSWルートを再生成
npm run build           # 型チェックとアプリのビルド
npm run build-storybook # Storybookの静的ビルド
npm run test:e2e        # Storybook上の操作テスト
```

依存の正確なバージョンはpackage-lock.jsonを使用します。ブラウザーテストの実行条件・制限は画面設計の記録を参照してください。差分確認には `git diff --check` を使用します。

モックの変更は再読み込みでリセットされます。アルバム・お気に入り・ゴミ箱などの正式採用、本番API、CI、認証、保存・共有の結合テストは今後の検討対象です。マージと本番反映には別途POの承認が必要です。
