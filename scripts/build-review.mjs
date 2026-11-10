import console from 'node:console';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';

const require = createRequire(import.meta.url);
const swagger = require('swagger-ui-dist').getAbsoluteFSPath();
// 相対URLのみを生成し、GitHub Pagesのリポジトリ/PRサブパスでも動作させる。
const output = resolve('work/review-site');
// 外部参照を取得せず、リポジトリ内の契約だけを検証する。
await SwaggerParser.validate('api/openapi.yaml', {
  resolve: { external: false },
});
await rm(output, { recursive: true, force: true });
await mkdir(`${output}/api`, { recursive: true });
await cp('apps/frontend/storybook-static', `${output}/storybook`, {
  recursive: true,
});
for (const file of ['swagger-ui.css', 'swagger-ui-bundle.js']) {
  await cp(`${swagger}/${file}`, `${output}/api/${file}`);
}
await cp('api/openapi.yaml', `${output}/api/openapi.yaml`);
await writeFile(
  `${output}/api/index.html`,
  `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenAPI レビュー</title><link rel="stylesheet" href="./swagger-ui.css"></head>
<body><header><a href="../">レビューの入口</a><h1>OpenAPI レビュー案</h1>
<p>APIの実装・承認済みであることを示すものではありません。APIへの実リクエスト送信は無効です。</p>
<a href="./openapi.yaml">元のOpenAPI定義</a></header>
<div id="swagger-ui"></div><script src="./swagger-ui-bundle.js"></script><script src="./init.js"></script></body></html>`,
);
await writeFile(
  `${output}/api/init.js`,
  `SwaggerUIBundle({
  url: './openapi.yaml', dom_id: '#swagger-ui',
  supportedSubmitMethods: [], tryItOutEnabled: false,
  validatorUrl: null, persistAuthorization: false,
  withCredentials: false, deepLinking: true
});\n`,
);
await writeFile(
  `${output}/index.html`,
  `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PR レビュー資料</title></head><body><main><h1>PR レビュー資料</h1>
<p>レビュー対象の提案です。製品の実装完了・仕様承認を意味しません。</p>
<p><a href="./revision.html">対象PR・コミット</a></p>
<ul><li><a href="./storybook/">Storybook</a></li><li><a href="./api/">OpenAPI</a></li></ul>
</main></body></html>`,
);
console.log(`Review site: ${output}`);
