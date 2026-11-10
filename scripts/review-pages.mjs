import { cp, lstat, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export function previewPath(number) {
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error('Invalid PR number');
  }
  return `pr/${number}`;
}

// ビルド成果物はデータとして扱い、公開権限のあるジョブで実行しない。
export async function validateArtifact(directory) {
  let count = 0;
  let bytes = 0;
  async function walk(path) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error('Symlinks are not allowed');
    if (stat.isDirectory()) {
      for (const entry of await readdir(path)) {
        if (entry.startsWith('.'))
          throw new Error('Hidden paths are not allowed');
        await walk(join(path, entry));
      }
    } else if (stat.isFile()) {
      count += 1;
      bytes += stat.size;
      if (count > 10000 || bytes > 150 * 1024 * 1024) {
        throw new Error('Preview artifact exceeds limits');
      }
    } else {
      throw new Error('Only regular files are allowed');
    }
  }
  await walk(directory);
  for (const required of [
    'index.html',
    'storybook/index.html',
    'api/index.html',
    'api/openapi.yaml',
  ]) {
    if (!(await lstat(join(directory, required))).isFile()) {
      throw new Error(`Missing file: ${required}`);
    }
  }
}

export async function updatePreview({
  root,
  artifact,
  number,
  sha,
  remove = false,
}) {
  const target = resolve(root, previewPath(number));
  if (!remove) {
    if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid commit SHA');
    await validateArtifact(artifact);
  }
  await rm(target, { recursive: true, force: true });
  if (!remove) {
    await cp(artifact, target, { recursive: true });
    await writeFile(
      join(target, 'revision.html'),
      `<!doctype html><html lang="ja"><meta charset="utf-8"><title>レビュー対象</title><h1>PR #${number}</h1><p>対象コミット: <code>${sha}</code></p><a href="./">レビューの入口</a></html>`,
    );
  }
  let entries;
  try {
    entries = await readdir(join(root, 'pr'), { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    entries = [];
  }
  const numbers = entries
    .filter((e) => e.isDirectory() && /^[1-9][0-9]*$/.test(e.name))
    .map((e) => Number(e.name))
    .sort((a, b) => b - a);
  await writeFile(join(root, '.nojekyll'), '');
  await writeFile(
    join(root, 'index.html'),
    `<!doctype html><html lang="ja"><meta charset="utf-8"><title>レビュー資料</title><h1>PR レビュー資料</h1><p>公開のレビュー用資料です。承認済み仕様や稼働中アプリではありません。</p><ul>${numbers.map((n) => `<li><a href="./pr/${n}/">PR #${n}</a></li>`).join('')}</ul></html>`,
  );
}
