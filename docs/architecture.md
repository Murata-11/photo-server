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

## 48MP画像処理（Issue #20・#35）

[ADR 0007](decisions/0007-48mp-only.md)に従い、標準配布のsharpでJPEG/PNG/WebPを扱う。HEIC専用のネイティブビルドと検査プログラムは廃止した。全形式の処理を子プロセスへ分離し、アプリ全体で1件処理・2件待機・30秒上限を適用する。元ファイル保存・DB登録は画像検証後に行い、既存の永続化・認証・DBスキーマは維持する。

## 写真の一括ゴミ箱移動（Issue #26）

OpenAPI `trashPhotos` を実APIに実装する。既存の写真行をID順に `FOR UPDATE` でロックし、全件存在を確認した同一トランザクション内で `deleted=true` にする。既移動は成功として更新を省略し、不存在・DBエラーでは全件ロールバックする。個別所属・一括アルバム追加・単一削除・復元と同じ写真行ロックで直列化し、所属・画像・メタデータ・お気に入りを変更しない。DB移行・写真ファイルの操作はない。応答喪失時は同じIDを安全に再送できる。

## 外観設定（Issue #44）

保存値はブラウザのlocalStorage `hiyori.appearance`。`src/appearance-bootstrap.js` が保存値・OS設定を評価し、documentの配色・color-scheme・theme-colorを更新する。ViteとStorybookの設定が同じソースをHTMLのheadへ同期スクリプトとして挿入し、アプリの初回描画前に配色を決める。Appからも冪等な初期化として読み込み、`useSyncExternalStore`で選択・適用配色・保存不可状態を購読する。React描画と初期HTMLの判定ロジックを二重管理しない。

OSの変更はMediaQueryList、別タブの保存・削除・clearはlocalStorageのstorageイベントで反映する。sessionStorageや他のキーは無視する。保存不可時はメモリ内の選択を優先して保持し、写真操作は継続する。API・DB・認証・写真ファイル・依存ライブラリは変更しない。

## アルバムの削除（Issue #51）

OpenAPI `deleteAlbum`（DELETE `/api/albums`）を実APIに実装する。JSONの名前を正規化せず完全一致で指定し、アルバム行を`FOR UPDATE`でロックしてから所属行とアルバム行を同一トランザクションで削除する。不在は204。既存の所属編集・一括追加は同じアルバム行を`FOR KEY SHARE`で保持するため、先行編集の確定後に所属を削除し、削除後の編集は404となる。削除側は写真行をロック・変更せず、既存の「写真→アルバム」の取得順との循環待ちを作らない。途中失敗時は全件ロールバックする。

通常・ゴミ箱内の全写真と他所属を保持し、DB構造変更や画像ファイル操作は行わない。同名再作成には以前の所属を引き継がない。現行モデルは名前を識別に使うため、結果不明時に削除を自動再送せず、承認済みUIで現状を再確認する。
