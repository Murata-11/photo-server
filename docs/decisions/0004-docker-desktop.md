# ADR 0004：WindowsのDocker Desktopでアプリを稼働

- 決定日：2026-11-10
- 着手根拠：POのチャット「アプリもDockerで動かしたい」、続く訂正「DockerアプリでWindows上で動かしたい」。
- 対象：WindowsのDocker Desktop（WSL2バックエンド・Linuxコンテナ）でアプリとDBを起動する構成。Windowsコンテナは使用しない。
- 本番反映・マージは今回の依頼に含めない。

## 構成

ReactをビルドしてHonoから静的配信する単一のアプリイメージと、既存のPostgreSQLコンテナをComposeで起動する。ホストへのNode.js・pnpmの導入は通常利用には不要。Windows上のTailscale ServeからWindowsの`127.0.0.1:3000`へ転送する前提とする。WSL2 UbuntuでアプリやTailscaleを手動起動する手順は不要。

Dockerの転送を受けるため、イメージ内では`HOST=0.0.0.0`で待ち受ける。Composeの公開先は`127.0.0.1:3000`に限定する。通常のNode.js直接起動は従来どおり`127.0.0.1`が既定。ADR 0003の待受方針は、コンテナ内とホスト公開を分ける形で更新する。認証・CSRFは維持する。PC内のプロセスに加えてDockerを操作できる利用者と同一Composeネットワークを信頼し、信頼できないコンテナを同じネットワークへ参加させない。

DBへはサービス名`db`で接続する。元写真・表示画像は`photo-files`、DBは既存の`photo-db`という名前付きvolumeに永続化する。Windowsパスをコンテナ内パスとして使用しない。既存のホスト写真ディレクトリは自動移行しない。DBも、従来と同じプロジェクト名・保存先でのみ既存volumeを引き継ぐ。

DBのhealthcheck成功後、非rootのアプリが初期DDLを適用して起動する。DDLは既存テーブルの変更を行う移行機構ではない。既存スキーマの更新方式は引き続き別途設計する。

## 検証の限界

管理されたLinux環境でイメージのビルドとCompose経由の動作を検証し、Windows Docker Desktop・実端末のTailscale通信は別途確認する。実機確認前にWindowsで動作検証済みとは扱わない。PCの停止・スリープ、Docker Desktop停止中は利用できない。データのバックアップと別環境への復元確認は本番開始前に必要。

## ローカル検証記録

2026-11-10、専用Composeプロジェクト・専用volume・架空の利用者と既存フィクスチャ画像で確認。

- Dockerイメージのビルド成功。Reactとバックエンドの型検査・ビルドを含む。
- Compose設定検証成功。DB・アプリがhealthyになることを確認。
- 認証なしのHTML・API・元画像は401、未許可利用者・Funnelヘッダー・CSRF条件を満たさない更新は403。
- 許可利用者による静的HTML・一覧・追加・サムネイル表示と、元画像のダウンロード内容の一致を確認。
- アプリ・DBの両コンテナ再作成後、もう1人の許可利用者から一覧・元画像・サムネイルを取得でき、元画像の一致を確認。
- 変更した対応ファイルのPrettier検証と`git diff --check`成功。
- GitHub APIがForbiddenとなりIssue・既存PRの照会ができなかったため、ローカルの`feat/docker-desktop-app`で作業。Issue・PRは未作成。
