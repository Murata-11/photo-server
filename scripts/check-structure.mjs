import { readdir } from 'node:fs/promises';

// 宣言・テストだけでアプリの型検査を通過させない。
for (const root of ['src/frontend', 'src/backend']) {
  let files;
  try {
    files = await readdir(root, { recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    files = [];
  }
  if (
    !files.some(
      (file) =>
        /\.tsx?$/.test(file) &&
        !/\.d\.ts$|\.(test|spec|stories)\.tsx?$/.test(file),
    )
  ) {
    throw new Error(
      `${root}: TypeScriptアプリコードが未実装です。空の検査は合格にしません。`,
    );
  }
}
