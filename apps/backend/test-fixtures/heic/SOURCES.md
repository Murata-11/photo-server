# HEICテスト素材

すべて本Issueのテスト用に生成した合成画像。実在の写真・本番データは含まない。

- 作成元：sharp 0.35.5の単色画像（#55aacc）、64×48の4色矩形SVG、半透明の単色PNG。
- 48mp.heic：8064×6048。60mp.heic：10000×6000。tiny.heic：64×48。32pxの従属サムネイル付き。
- multiple.heic：tinyの独立画像2枚。
- ten-bit.heic：16-bit PNGから10-bit HEVCへ変換。
- alpha.heic：半透明PNGから補助アルファ画像付きHEICへ変換。
- orientation.heic：4色矩形JPEGと合成EXIF（Orientation=6、Artist、撮影日時）から変換。

生成ツール：Debian bookwormのlibheif-examples 1.15.1（x265）。これは素材生成用だけで、アプリのランタイムにはHEVCエンコーダーを含めない。

```sh
heif-enc -q 35 -p preset=ultrafast -p x265:pools=2 -t 32 input.png -o output.heic
heif-enc -q 35 -p preset=ultrafast -p x265:pools=2 tiny.png tiny.png -o multiple.heic
heif-enc -q 40 -p preset=ultrafast -p x265:pools=2 -b 10 ten-bit.png -o ten-bit.heic
```

単色素材は機能・寸法・メモリ上限の検証用。実際のiPhoneの複雑な写真・HDR・機種差・実際の処理時間の代表値とは扱わない。実機素材の確認はPO担当。

追加素材：

- rotated.heic / mirrored.heic：`native/make-oriented-fixture.cc`で4色矩形を生成。コンテナの回転／反転とExif Orientation=6を併記し、二重回転を検出する。libheif 1.15.1が回転後のispeを記録したrotatedについては、ジェネレーター内でispeの48×64を回転前64×48へ正規化する（同じ長さの2整数だけを置換）。宣言寸法とデコード寸法の検証は緩和しない。
- over60mp.heic：10000×6001の単色PNGから生成。
- video.mp4：FFmpegの`color=c=red:s=64x48:d=0.1`をlibx265（pools=2）で符号化した合成動画。
- with-video.heic：tiny.heicに上記動画のmoovボックスを追加した拒否試験用。正常な写真として扱わない。
