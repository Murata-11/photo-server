# photo-server

**Windows の Docker Desktop で動かす、2人専用の写真共有アプリです。**
写真の追加・閲覧・ダウンロード、アルバム、お気に入り、ゴミ箱・復元に対応します。PC・スマートフォンから、Tailscale 経由で利用します。

1. [構成](#1-構成)
2. [Tailscale の設定](#2-tailscale-の設定)
3. [デプロイ手順](#3-デプロイ手順)

## 1. 構成

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

## 3. デプロイ手順

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

---

開発者向けの起動・テスト・Storybookは[開発・検証](docs/development.md)にまとめています。詳細は[製品仕様](docs/product.md)、[設計](docs/architecture.md)、[Docker Desktopの判断記録](docs/decisions/0004-docker-desktop.md)、[運用手順](docs/operations.md)、[開発の合意事項](CONTRACT.md)を参照してください。
