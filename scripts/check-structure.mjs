import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const requiredApps = ['apps/frontend', 'apps/backend'];
const requiredScripts = ['typecheck', 'test:coverage', 'build'];

export async function checkWorkspaces(root, workspaces) {
  const paths = new Set(workspaces.map(({ path }) => resolve(path)));
  for (const app of requiredApps) {
    if (!paths.has(resolve(root, app))) {
      throw new Error(`${app}: 必須workspaceが見つかりません。`);
    }
  }

  for (const { path } of workspaces) {
    if (resolve(path) === resolve(root)) continue;
    const manifest = JSON.parse(
      await readFile(resolve(path, 'package.json'), 'utf8'),
    );
    for (const script of requiredScripts) {
      if (
        typeof manifest.scripts?.[script] !== 'string' ||
        !manifest.scripts[script].trim()
      ) {
        throw new Error(
          `${manifest.name}: 必須スクリプト ${script} がありません。`,
        );
      }
    }

    let files;
    try {
      files = await readdir(resolve(path, 'src'), { recursive: true });
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
        `${manifest.name}: TypeScriptアプリコードが未実装です。空の検査は合格にしません。`,
      );
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  // pnpm自身が認識するworkspaceを使い、将来追加した共有パッケージも検査する。
  const result = spawnSync('pnpm', ['list', '-r', '--depth', '-1', '--json'], {
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(result.stderr || 'workspace一覧の取得に失敗しました。');
  await checkWorkspaces(process.cwd(), JSON.parse(result.stdout));
}
