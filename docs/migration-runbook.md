# DB変更・サーバー移行の手順

状態：レビュー用の手順。実データの変更・移送は実施していない。Windows、Ubuntu Raspberry Pi / ARM64、実Tailscale端末での復元訓練は未実施。本書の追加はUbuntuへの構成変更や本番操作の承認ではない。承認の基準は[CONTRACT](../CONTRACT.md)、通常運用は[運用手順](operations.md)、新規導入は[README](../README.md)を参照する。

## 作業前に決めること

作業記録に次を記入し、対象コミットと影響を示して本番適用の承認を得る。DB変更とホスト移行は別の作業として計画し、原則として同時に行わない。ホスト移行は旧ホストと同じコミット・PostgreSQLメジャーバージョンで復元してから、別のリリースで機能を更新する。

- 目的、対象Issue / PR、旧・新コミット、実施者、確認者、承認の参照先。
- 旧・新ホスト、CPU / OS、Docker / Compose / PostgreSQLのバージョン、Composeプロジェクト名、実行ディレクトリ。
- DB版とアプリ互換性、削除・変換するデータ、想定件数、検証SQL、必要な空き容量と停止時間。
- 写真保存先、DB volume、バックアップ先、設定・秘密情報の安全な保管先。秘密値を作業記録へ貼らない。
- 停止開始・再開予定、RPO / RTO、再開判定者、切り戻し期限、復元で失う更新、バックアップ保持期間。
- 本番データを隔離環境で扱う場合の承認・アクセス制限。通常の開発検証は架空画像と専用DBを使う。

各コマンドは成功を確認してから次へ進む。停止・バックアップ・復元の失敗、件数やハッシュ不一致なら中断し、アプリを停止したまま原因を調べる。`down -v`、volume削除、履歴の手動編集を復旧方法にしない。

## 1. 整合バックアップ

旧ホストの既存のComposeディレクトリ・プロジェクトで行う。すべての書き込み元（app、直接起動のアプリ、バッチ等）を停止し、バックアップ完了まで再起動しない。DBは起動したままにする。利用者には停止を案内する。自動更新・ホスト再起動でも旧appが復帰しないよう作業中は管理する。

DB、写真ディレクトリ全体（`.original`と`.jpg`、ゴミ箱分も含む）、旧コミット、旧イメージのIDまたは保存済み成果物、設定を同じバックアップIDで保持する。旧版の再ビルドだけに復旧を依存させない。

### Windows PowerShell

以下の写真パスは実際の`PHOTO_STORAGE_PATH`へ置き換える。新規のバックアップディレクトリを使う。

```powershell
$ErrorActionPreference = 'Stop'
docker compose stop app
if ($LASTEXITCODE -ne 0) { throw 'app停止失敗' }
$backupRoot = Join-Path (Get-Location) ('work/backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backupRoot | Out-Null
git rev-parse HEAD | Set-Content (Join-Path $backupRoot 'old-commit.txt')
Copy-Item .env (Join-Path $backupRoot '.env')
docker compose exec -T db pg_dump -U photo -d photo -Fc -f /tmp/photo-before.dump
if ($LASTEXITCODE -ne 0) { throw 'pg_dump失敗' }
docker compose cp db:/tmp/photo-before.dump (Join-Path $backupRoot 'db.dump')
if ($LASTEXITCODE -ne 0) { throw 'dump取得失敗' }
Copy-Item -LiteralPath '<実際のPHOTO_STORAGE_PATH>' -Destination (Join-Path $backupRoot 'photos') -Recurse
Get-FileHash -Algorithm SHA256 (Join-Path $backupRoot 'db.dump')
Get-ChildItem (Join-Path $backupRoot 'photos') -File -Recurse | Get-FileHash -Algorithm SHA256 | Export-Csv (Join-Path $backupRoot 'photo-hashes.csv') -NoTypeInformation -Encoding UTF8
```

バイナリdumpをPowerShellの`>`で保存しない。ハッシュ一覧の絶対パスは移送先で異なるため、写真ディレクトリからの相対名で照合する。旧保存先とバックアップのファイル名・件数・サイズ・SHA-256が全件一致することを確認する。

### Ubuntu Bash

`backupRoot`と写真パスは実際の専用保存先へ変更する。sudoを使うrootful Dockerの例。

```sh
set -eu
umask 077
backupRoot="$PWD/work/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backupRoot"
sudo docker compose stop app
git rev-parse HEAD > "$backupRoot/old-commit.txt"
cp .env "$backupRoot/.env"
sudo docker compose exec -T db pg_dump -U photo -d photo -Fc -f /tmp/photo-before.dump
sudo docker compose cp db:/tmp/photo-before.dump "$backupRoot/db.dump"
sudo cp -a /srv/photo-server/photos "$backupRoot/photos"
sudo sha256sum "$backupRoot/db.dump"
sudo sh -c 'cd "$1" && find . -type f -exec sha256sum {} \;' sh "$backupRoot/photos" > "$backupRoot/photo-hashes.sha256"
```

両OSとも停止後のDB件数（通常・ゴミ箱、アルバム、所属）と`schema_migrations`の版・チェックサムを記録する。履歴なし旧DBはその事実と構造を記録する。ファイルの孤立や欠落は勝手に削除・修復せず記録する。バックアップ一式をアクセス制限・暗号化した別媒体へ複製し、dumpの一覧表示だけで完了とせず、次の隔離復元を実施する。

## 2. 空の専用環境への復元

本番DBへ上書きしない。例はUbuntuで、新しい復元専用checkoutを用意し、バックアップ時のコミットをcheckout済みとする。専用の`.env`を作り、`PHOTO_STORAGE_PATH`には復元専用ディレクトリを指定する。DBパスワードの2項目は一致させる。旧`.env`は保管し、Windowsパスをそのまま使わない。

`photo-restore-YYYYMMDD`は作業ごとに未使用の名前へ変更する。既存volumeがないことを確認する。既存Composeはホストポートを固定しているため、同一ホスト上の他スタックの3000 / 5432と競合する。隔離VM・別ホストを使い、プロジェクト名を変えただけで同時稼働できると考えない。隔離環境へ本番Serveを向けない。

1. 写真バックアップの全ファイルを空の復元専用ディレクトリへコピーし、全件ハッシュを照合する。Ubuntuではその専用コピーだけをUID / GID 1000で読み書き可能にする。共有フォルダー全体の所有者を変更しない。
2. appを起動する前にDBだけを起動し、空のDBへ復元する。

```sh
sudo docker compose -p photo-restore-YYYYMMDD up -d --wait db
sudo docker compose -p photo-restore-YYYYMMDD cp /secure/backup/db.dump db:/tmp/photo-restore.dump
sudo docker compose -p photo-restore-YYYYMMDD exec -T db pg_restore --list /tmp/photo-restore.dump
sudo docker compose -p photo-restore-YYYYMMDD exec -T db pg_restore -U photo -d photo --exit-on-error --single-transaction --no-owner --no-privileges /tmp/photo-restore.dump
```

`/secure/backup/db.dump`は実際の移送済みdumpへ変更する。各コマンドの終了コードを確認する。新規Compose DBには`POSTGRES_USER=photo`のロールが作られるため、このロールへ復元する。アプリ起動で先にスキーマを作らない。空でないDBや復元失敗先に重ねて再実行せず、原因解決後に別の空の専用環境でやり直す。PostgreSQLのデータディレクトリやDocker Desktopのvolume実体をWindowsからARM64へコピーしない。

3. DB件数・所属・履歴と写真ハッシュをバックアップ時の記録に照合してから、同じプロジェクト名で旧コミットのappをビルド・起動する。

```sh
sudo docker compose -p photo-restore-YYYYMMDD up -d --build --wait app
sudo docker compose -p photo-restore-YYYYMMDD ps
sudo docker compose -p photo-restore-YYYYMMDD exec app sh -c 'id && test -w /data/photos'
```

4. 下記の再開判定を検証し、復元所要時間と結果を記録する。本番切り替えには対象DB・写真パス・失われる更新を示した承認が必要。

## 3. 破壊的なDB変更を伴う機能追加

### 開発・リハーサル

- Issueに変更前後の構造、データの変換・欠損の扱い、旧アプリとの互換性、検証SQL、停止時間・ロック、バックアップと復旧方法を書く。重要な設計判断はADRとして提案する。UI / API変更はそれぞれのSSOTも更新する。
- バージョン付きSQLを追加し、`apps/backend/src/store.ts`の適用順へ登録する。適用済みSQLを編集しない。参照用`schema.sql`と`db/schema.dbml`を合わせる。既存DBへ`schema.sql`を直接実行しない。
- 現行の移行は起動時・専用接続・advisory lock・全体トランザクションで実行される。トランザクション外が必要な処理は、この仕組みにそのまま追加せず別途設計する。写真ファイルの変換はDBロールバックで戻らないため、別の復旧手順が必要。
- 架空データで新規DB、旧DB（ゴミ箱・未所属・空アルバムを含む）、再実行、途中失敗、排他、想定外の構造と履歴拒否を確認する。変換前後の件数だけでなく、所属ペアや保持すべき値を照合する。
- 旧バックアップから旧版へ戻す復元訓練と、新版への移行を隔離環境で行う。旧版だけに戻せる条件を明示する。情報を失うdown migrationを自動生成しない。

### 本番適用

1. 合意した変更と検証結果、対象コミット、停止・復旧計画について承認を確認する。
2. 書き込みを止め、手順1のバックアップを取得する。利用者の接続は止めたままにする。現構成にメンテナンスモードはないため、実施時にServeの転送を停止し、作業者だけの検証経路を確保する。
3. 固定した対象コミットを取得し、通常のComposeプロジェクトで`docker compose up -d --build --wait`（Ubuntuはsudo）を実行する。起動時にDB移行されるため、試しにappを起動するだけでもDB変更が起きる。
4. 移行履歴・ログと変換結果、下記の再開判定を確認する。失敗・タイムアウト時は`app`を停止する。自動再起動で調査中に処理を繰り返させない。履歴不一致を手動編集で回避しない。
5. 検証結果を記録し、利用者の接続を戻す。ブラウザーの旧タブを再読み込みする。

失敗時はDBの実際の版と互換性を確認する。移行がロールバック済みで旧版との互換性を確認できた場合だけ旧appを再開できる。コミット済みで互換性がない場合は旧コードだけに戻さず、手順2で移行前DB・対応写真・旧コード・設定を復元してから承認された切り替えを行う。書き込み再開後の復旧ではバックアップ以降の更新が失われるため、損失範囲と回収方法を判断してから進める。

## 4. Windows PC → Ubuntu Raspberry Pi

### 事前準備

1. README第4節に従い64bit Ubuntu / ARM64、Docker Engine、Compose、Tailscaleを準備する。電源・冷却・ディスク空き容量、写真ディスクの永続マウントを確認する。外部ディスクがマウントされないまま空フォルダーで起動しない運用を決める。
2. 旧ホストと同じコミットをPiでビルドする。Windowsのイメージや`node_modules`を移さない。PostgreSQLメジャー更新を同時に行わず、ARM64実機のビルド・写真処理・再起動を架空データで先に確認する。
3. Piの新しいServe URL、Tailnetのアクセス制御、`APP_ORIGIN`、`ALLOWED_USERS`、写真パスと権限を準備する。`DEV_USER`は設定しない。Funnelを使わず3000 / 5432はループバックに限定する。旧ホストのTailscale認証情報・ホストIDをコピーせず、新ノードとして参加させる。
4. 本番データでのリハーサルには承認を確認し、アクセスを制限する。リハーサルのコピーをそのまま最終データとして使わない。

### 最終移送と切り替え

1. 停止を案内し、WindowsのServe経由の利用を止め、旧appと他の書き込み元を停止する。DBだけ動かしたまま最終バックアップを取得する（手順1）。旧ホストは切り戻し用に保持する。
2. DB dump、写真全体、ハッシュ記録を、アクセス制限した暗号化転送（例：承認したSSH / SCP、暗号化媒体）でPiへ移送する。dumpと写真全件のハッシュ・件数を照合する。設定の秘密情報は安全な経路で渡す。旧ホストの設定をPiへ無加工で適用しない。
3. Piの空の専用DB・写真ディレクトリへ手順2で復元する。事前検証で既にappを起動していたDBへ上書きしない。以降は復元時と同じComposeプロジェクト名・写真パスを使う。
4. 旧appを停止したままPiだけを起動して下記の再開判定を確認する。Piの新HTTPS URLを2人に案内し、`APP_ORIGIN`との一致を確認する。Windowsの旧URLは利用させない。旧・新両方で書き込みを許可しない。
5. 再起動後のDocker・Tailscale・写真ディスク・コンテナの復帰を確認し、移行完了とする。旧データ・バックアップは合意した期限まで保持し、削除は別途承認する。

### 切り戻し

- Piで書き込みを再開する前なら、Piのappと利用経路を停止し、旧WindowsのDB・写真が停止時のまま一致していることを確認して旧appと旧Serve URLを再開する。
- Piで更新が発生した後は、単にWindowsを再開すると更新が失われる。Piを停止してDB・写真を一組で保全し、失われる更新を明示して承認を得る。同じDB版ならPiの最新バックアップをWindowsの空の専用環境へ戻す案、互換性がなければ別途のデータ移行案を作る。自動の双方向同期やデータ統合は行わない。

## 再開判定と記録

- app / dbがhealthy、移行履歴・チェックサムが対象版と一致し、移行・保存エラーがない。
- 通常・ゴミ箱の写真数、未所属、空アルバム、所属ペアが計画どおり。既存の元写真・表示画像が全件存在しハッシュが一致する。変更対象ファイルがある場合は事前の変換計画と照合する。
- 2人がHTTPS経由で一覧・既存写真の表示・元画像ダウンロード・アルバム・ゴミ箱からの復元を確認する。元画像のSHA-256が一致する。
- 承認されたテスト写真で追加・表示・ダウンロードと再起動後の保持を確認する。本番写真を検証目的で削除しない。
- 未許可利用者と認証情報なしの直接HTTP接続が拒否され、LANから3000 / 5432へ直接到達しない。healthcheckだけで実Tailscale認証の完了としない。
- バックアップID、対象コミット、OS / CPU / DB版、停止・再開時刻、実施者、照合結果、復元所要時間、承認参照、残る問題、切り戻し期限を安全な運用記録へ残す。未実施項目を成功として記録しない。
