# photo-server

**2人専用の写真共有アプリです。** Windows の Docker Desktop 向け手順と、Ubuntu の Docker Engine 向け手順を掲載しています。
写真の追加・閲覧・ダウンロード、アルバム、お気に入り、ゴミ箱・復元に対応します。PC・スマートフォンから、Tailscale 経由で利用します。JPEG・PNG・WebPの静止画像に対応し、1枚50MB（50MiB）までアップロードできます。

1. [構成](#1-構成)
2. [Tailscale の設定](#2-tailscale-の設定)
3. [Windows のデプロイ手順](#3-windows-のデプロイ手順)
4. [Ubuntu のデプロイ手順（Raspberry Pi / ARM64）](#4-ubuntu-のデプロイ手順raspberry-pi--arm64)

## 1. 構成

以下はWindowsの構成です。UbuntuではDocker Engineを使います。[手順4](#4-ubuntu-のデプロイ手順raspberry-pi--arm64)を参照してください。

```text
利用者2人のPC・スマートフォン
  │ Tailscale（同じTailnetに参加）
  │ HTTPS
  ▼
Windows PC
  Tailscale Serve
    │ http://127.0.0.1:3000
    ▼
  Docker Desktop（WSL2バックエンド / Linuxコンテナ）
    ├ app：Hono API ＋ ビルド済みのReact画面
    │   ├ db:5432 → db：PostgreSQL
    │   └ /data/photos → Windowsの指定フォルダー：元写真・表示画像
    └ db → photo-db volume：写真情報・アルバムなど
```

| 要素           | 役割・配置                                                    |
| -------------- | ------------------------------------------------------------- |
| Docker Desktop | Windows上でアプリとDBの2コンテナを管理                        |
| アプリ         | Node.js 24 / Hono。Reactの画面も同じコンテナから配信          |
| DB             | PostgreSQL 17.9。アプリとはDocker内のネットワークで接続       |
| 写真           | `.env`の`PHOTO_STORAGE_PATH`で指定したWindowsフォルダーに保存 |
| DBデータ       | Dockerの`photo-db` volumeに保存。コンテナを作り直しても保持   |
| Tailscale      | Windowsと利用者の端末に導入。ServeがHTTPSの入口を提供         |

WSL2はDocker Desktopの内部基盤として使います。通常利用では、Ubuntu内での手動起動やWindowsへのNode.js・pnpmの導入は不要です。

Windowsへのポート公開は`127.0.0.1:3000`（アプリ）と`127.0.0.1:5432`（DB）に限定しています。利用者には**TailscaleのHTTPS URL**を案内します。インターネットへのポート開放は不要です。

## 2. Tailscale の設定

### 2-1. Windowsと利用端末を同じTailnetへ参加させる

1. サーバーにするWindows PCに[Tailscale](https://tailscale.com/download/windows)をインストールし、ログインします。
2. [Tailscale管理画面](https://login.tailscale.com/admin/users)から、もう1人の利用者を同じTailnetへ招待します。
3. 2人が利用するPC・スマートフォンにもTailscaleをインストールし、それぞれ自分のアカウントでログインします。
4. 管理画面のMachinesで、Windows PCと利用端末が接続されていることを確認します。

このアプリはServeが付ける利用者情報で認証します。利用端末はユーザーに所属する端末を使ってください。**タグ付き端末からの利用は拒否します。**

### 2-2. WindowsでServeを有効にし、URLを確認する

WindowsのPowerShellで実行します。

```powershell
tailscale status
tailscale serve --bg http://127.0.0.1:3000
tailscale serve status
```

初回に設定用URLが表示された場合は、ブラウザーで開いてServe / HTTPSを有効にしてから、もう一度実行します。管理者権限を求められた場合は、PowerShellを管理者として開き直します。

表示されたHTTPS URLを控えます。例：

```text
https://photo-pc.example-tailnet.ts.net
```

この時点でアプリが未起動なら、URLを開いても画面は表示されません。次のデプロイ手順を完了してから確認します。

### 2-3. 許可する2人を決める

Tailscale管理画面のUsersで、2人のログイン名を確認します。アプリの`ALLOWED_USERS`には、このログイン名をカンマ区切りで設定します。端末名や表示名ではありません。

- Tailnetに参加していても、`ALLOWED_USERS`にない利用者はアプリを使えません。
- Tailnet側にアクセス制御を設定している場合は、2人の端末からWindows PCのTCP 443への接続を許可します。
- **Tailscale Funnelは使用しません。** アプリの3000番・DBの5432番をLANやインターネットへ公開しないでください。

ServeはWindowsのローカル接続をアプリへ転送します。この構成では、Windows上のプロセスとDockerを操作できる利用者を信頼します。

## 3. Windows のデプロイ手順

### 3-1. Docker Desktopとソースを準備する

1. Windowsに[Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/)をインストールして起動します。
2. Settings → Generalの **Use the WSL 2 based engine** を有効にし、Linuxコンテナを使用します。
3. Gitを用意し、PowerShellでリポジトリを取得します。すでに取得済みなら、そのフォルダーへ移動します。

```powershell
git clone https://github.com/Murata-11/photo-server.git
cd photo-server
```

以降のコマンドは、`compose.yaml`のあるフォルダーで実行します。デプロイするコードには、`Dockerfile`とアプリ定義を含む`compose.yaml`が必要です。

### 3-2. `.env`を設定する

初回だけ実行します。既存の`.env`がある場合はコピーせず、内容を確認してください。

```powershell
Copy-Item .env.example .env
notepad .env
```

次の項目を設定します。

| 項目                           | 設定する値                                                    |
| ------------------------------ | ------------------------------------------------------------- |
| `POSTGRES_PASSWORD`            | 自分で決めたDB用パスワード                                    |
| `POSTGRES_PASSWORD_URLENCODED` | 上と同じパスワードをURLエンコードした値                       |
| `PHOTO_STORAGE_PATH`           | 写真を保存するWindowsフォルダー。例：`D:/Photos/photo-server` |
| `APP_ORIGIN`                   | 手順2-2で確認したHTTPS URL。末尾の`/`は付けない               |
| `ALLOWED_USERS`                | 手順2-3で確認した2人のログイン名。カンマ区切り                |
| `DEV_USER`                     | **設定しない。既存の設定があれば削除する**                    |

パスワードには長くランダムな値を使います。英数字だけならURLエンコード後も同じ値です。記号を含む場合は、たとえば`@`を`%40`に変換します。

写真の保存先・URL・利用者の設定例です。実際の値に置き換えてください。

```dotenv
PHOTO_STORAGE_PATH=D:/Photos/photo-server
APP_ORIGIN=https://photo-pc.example-tailnet.ts.net
ALLOWED_USERS=first@example.com,second@example.com
```

`DATABASE_URL`・`PHOTO_DATA_DIR`・`PORT`はNode.js直接起動の開発用です。Dockerでの通常利用では変更不要です。`.env`には秘密情報が含まれるため、Gitに追加しません。

保存先フォルダーは起動前に作成してください。上の例なら次を実行します。

```powershell
New-Item -ItemType Directory -Force "D:/Photos/photo-server"
```

Windowsパスは`D:/Photos/photo-server`のように`/`区切りで指定します。空白を含む場合は`.env`で値を引用符で囲みます。未設定・空欄では起動できません。存在しないフォルダーも起動時にエラーになるため、ドライブ名とパスを確認してください。相対パスは`compose.yaml`のあるフォルダー基準です。例の初期値`./work/photo-data`を使う場合は、そのフォルダーを作成します。

元写真は`<写真ID>.original`、表示用画像は`<写真ID>.jpg`として同じフォルダーに保存します。アプリが管理するファイルなので、エクスプローラーから名前変更・削除しないでください。

### 3-3. ビルドして起動する

```powershell
docker compose up -d --build --wait
docker compose ps
```

`app`と`db`の両方が`healthy`になれば起動完了です。初回はイメージ取得とビルドに時間がかかります。DBの準備を待って初期テーブルを作成し、その後アプリが起動します。

### 3-4. 2人の端末から確認する

1. 各端末でTailscaleを接続します。
2. ブラウザーで`APP_ORIGIN`に設定したHTTPS URLを開きます。
3. 1人がテスト用写真を追加し、もう1人が表示・ダウンロードできることを確認します。

`http://127.0.0.1:3000`をブラウザーで直接開くと、Tailscaleの利用者情報がないため認証エラーになるのが通常です。**TailscaleのHTTPS URLから接続してください。**

### 更新・停止・再開

更新時は、承認されたコードを取得し、DBと写真をバックアップしたうえで再ビルドします。同じフォルダー・Composeプロジェクト名を使ってください。

```powershell
docker compose up -d --build --wait
```

`.env`だけを変更した場合も、`docker compose up -d --wait`でコンテナへ反映します。Docker Desktopの単なる再起動では設定変更は反映されません。

```powershell
# 停止
docker compose stop

# 再開
docker compose up -d --wait
```

初回作成後は、Docker DesktopのContainers画面からプロジェクト全体を停止・起動することもできます。Windows・Docker Desktopの停止中やPCのスリープ中は利用できません。

**`docker compose down -v`、volume削除、Docker Desktopのデータリセットは保存データを失います。通常の停止には使いません。** `PHOTO_STORAGE_PATH`を変更しても、保存済み写真は自動移動されません。旧構成の`photo-files` volumeを含め、保存先を切り替える場合はアプリを停止し、バックアップ後に元写真・表示画像を全て新しいフォルダーへコピーしてください。DBも対応するデータを維持します。新しい保存先で表示・ダウンロードを確認するまで旧データを削除しません。バックアップ・移行は[運用手順](docs/operations.md)を参照してください。初期テーブルの作成処理は、将来のスキーマ変更を行う移行機構ではありません。

### うまく接続できないとき

```powershell
docker compose ps
docker compose logs --tail 100 app db
tailscale status
tailscale serve status
```

| 症状                           | 確認すること                                                       |
| ------------------------------ | ------------------------------------------------------------------ |
| ビルド・起動に失敗             | Docker Desktopが起動しているか。ログと`.env`の必須項目を確認       |
| HTTPS URLが開かない            | 両端末のTailscale接続、Serveの転送先、TailnetのTCP 443の許可       |
| 利用者を確認できない           | HTTPS URLから開いているか。利用端末がタグ付きでないか              |
| 利用が許可されていない         | `ALLOWED_USERS`がTailscaleのログイン名と完全一致するか             |
| 写真の追加など更新操作だけ失敗 | `APP_ORIGIN`がアクセス中のHTTPSオリジンと一致し、末尾に`/`がないか |

この構成はLinux環境でビルド・認証・保存・コンテナ再作成後の永続性を確認しています。Windows Docker Desktop実機、実際のTailscale通信、バックアップからの復元は別途確認が必要です。

## 4. Ubuntu のデプロイ手順（Raspberry Pi / ARM64）

64bit Ubuntu（例：Ubuntu Server 24.04 LTS / ARM64）を使うRaspberry Piが対象です。既存の`Dockerfile`と`compose.yaml`をそのまま使い、Pi上でビルドします。Windows用にビルドしたイメージや`node_modules`はコピーしません。ホストへのNode.js・pnpmやDocker Desktopの導入は不要です。

**Raspberry Pi / ARM64実機でのビルド・起動・写真操作は未検証です。** Linux x86_64での検証とARM64用依存関係の確認に基づく手順であり、32bit Ubuntuは対象にしていません。

### 4-1. Docker Engineとソースを準備する

アーキテクチャを確認します。`aarch64` / `arm64`であることを確認してください。

```sh
uname -m
dpkg --print-architecture
```

[Docker公式のUbuntu向け手順](https://docs.docker.com/engine/install/ubuntu/)に従い、Docker EngineとComposeプラグイン（`docker-compose-plugin`）をインストールします。以下はrootful Dockerを`sudo`で操作する手順です。

```sh
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/Murata-11/photo-server.git
cd photo-server
```

以降は`compose.yaml`のあるフォルダーで実行します。取得済みの場合は既存のフォルダーへ移動してください。

### 4-2. UbuntuでTailscale Serveを設定する

[Tailscale公式のLinux向け手順](https://tailscale.com/download/linux)に従ってUbuntuにインストールし、利用端末と同じTailnetへ参加させます。

```sh
sudo systemctl enable --now tailscaled
sudo tailscale up
tailscale status
sudo tailscale serve --bg http://127.0.0.1:3000
tailscale serve status
```

初回に設定用URLが表示された場合は開いてServe / HTTPSを有効にします。表示されたHTTPS URLを`APP_ORIGIN`に使います。[手順2-3](#2-3-許可する2人を決める)と同様に2人のログイン名を確認し、アクセス制御がある場合は利用端末からUbuntuホストのTCP 443への接続を許可します。

アプリとDBのポートは既存のCompose設定どおりループバックだけに公開します。Funnelは使用しません。認証はServeの利用者情報を使うため、Ubuntu上のプロセスとDockerを操作できる利用者を信頼する構成です。

### 4-3. 写真保存先と`.env`を準備する

以下は**新規の専用保存先**を`/srv/photo-server/photos`とする例です。アプリコンテナは`node`ユーザー（UID / GID 1000）で動くため、そのユーザーが書き込めるようにします。bind mountでは、Dockerfile内の権限設定よりホスト側の権限が優先されます。

```sh
sudo install -d -o 1000 -g 1000 -m 0750 /srv/photo-server/photos
```

既存データがある場合は、新規導入として進めず[運用手順](docs/operations.md)に従ってDBと写真を一組でバックアップ・移行してください。既存の共有フォルダー全体に再帰的な所有者変更を行わないでください。

初回だけ`.env`をコピーして編集します。既存の`.env`は上書きしません。

```sh
cp .env.example .env
chmod 600 .env
nano .env
```

`POSTGRES_PASSWORD`と`POSTGRES_PASSWORD_URLENCODED`は[手順3-2](#3-2-envを設定する)に従って設定し、次の値を実際の保存先・HTTPS URL・ログイン名に置き換えます。

```dotenv
PHOTO_STORAGE_PATH=/srv/photo-server/photos
APP_ORIGIN=https://photo-pi.example-tailnet.ts.net
ALLOWED_USERS=first@example.com,second@example.com
```

`DEV_USER`は設定しません。`DATABASE_URL`・`PHOTO_DATA_DIR`・`PORT`はComposeでの通常利用では変更不要です。

### 4-4. ビルド・起動・動作確認

```sh
sudo docker compose up -d --build --wait
sudo docker compose ps
sudo docker compose exec app sh -c 'id && test -w /data/photos'
```

`app`と`db`が両方`healthy`で、保存先の書き込み確認が成功することを確認します。Piでの初回ビルドは時間がかかる場合があります。

2人の端末からTailscaleのHTTPS URLを開き、テスト写真の追加・表示・ダウンロードを確認します。`http://127.0.0.1:3000`への直接アクセスは、利用者情報がないため拒否されるのが通常です。未許可の利用者が拒否されることも確認してください。

### 更新・停止・再開とトラブルシューティング

更新前に承認されたコードを取得し、DBと写真をバックアップします。同じフォルダー・Composeプロジェクト名で実行してください。

```sh
# コード更新後の再ビルド
sudo docker compose up -d --build --wait

# 停止
sudo docker compose stop

# 再開（.envの変更も反映）
sudo docker compose up -d --wait

# 状態とログ
sudo docker compose ps
sudo docker compose logs --tail 100 app db
tailscale status
tailscale serve status
```

写真保存時に`EACCES`が出る場合は`PHOTO_STORAGE_PATH`の実際の保存先とUID 1000の書き込み権限を確認します。HTTPS接続・認証・Originの問題はWindows手順の[トラブルシューティング](#うまく接続できないとき)も参照してください。

DBは名前付きvolume、写真は指定したホストディレクトリに保存されます。**`sudo docker compose down -v`やvolume削除はDBデータを失うため、停止には使いません。** 保存先の変更だけでは既存写真は移動されません。ホストの停止・スリープ中は利用できません。再起動後にもDocker・Tailscale・アプリが復帰し、HTTPS経由で写真を表示できることを実機で確認してください。バックアップ・復元は[運用手順](docs/operations.md)に従います。

---

開発者向けの起動・テスト・Storybookは[開発・検証](docs/development.md)にまとめています。詳細は[製品仕様](docs/product.md)、[設計](docs/architecture.md)、[Docker Desktopの判断記録](docs/decisions/0004-docker-desktop.md)、[運用手順](docs/operations.md)、[開発の合意事項](CONTRACT.md)を参照してください。
