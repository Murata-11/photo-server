import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkWorkspaces } from './check-structure.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dod-workspaces-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspaces = [];
  async function add(path, { source = 'index.ts', scripts = {} } = {}) {
    const directory = join(root, path);
    await mkdir(join(directory, 'src'), { recursive: true });
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({
        name: path,
        scripts: {
          typecheck: 'tsc --noEmit',
          'test:coverage': 'vitest run --coverage',
          build: 'tsc',
          ...scripts,
        },
      }),
    );
    if (source) await writeFile(join(directory, 'src', source), 'export {};\n');
    workspaces.push({ path: directory });
  }
  return { root, workspaces, add };
}

test('必須workspaceが欠けた場合は失敗する', async (t) => {
  const f = await fixture(t);
  await f.add('apps/frontend');
  await assert.rejects(checkWorkspaces(f.root, f.workspaces), /apps\/backend/);
});

test('必須スクリプトの欠落を失敗にする', async (t) => {
  const f = await fixture(t);
  await f.add('apps/frontend', { scripts: { build: '' } });
  await f.add('apps/backend');
  await assert.rejects(
    checkWorkspaces(f.root, f.workspaces),
    /必須スクリプト build/,
  );
});

for (const source of [
  null,
  'index.d.ts',
  'index.test.ts',
  'index.stories.tsx',
]) {
  test(`実装が${source ?? '未配置'}だけの場合は失敗する`, async (t) => {
    const f = await fixture(t);
    await f.add('apps/frontend', { source });
    await f.add('apps/backend');
    await assert.rejects(checkWorkspaces(f.root, f.workspaces), /未実装/);
  });
}

test('追加した共有workspaceも検査する', async (t) => {
  const f = await fixture(t);
  await f.add('apps/frontend');
  await f.add('apps/backend');
  await f.add('packages/shared', { scripts: { typecheck: null } });
  await assert.rejects(
    checkWorkspaces(f.root, f.workspaces),
    /必須スクリプト typecheck/,
  );
});

test('両アプリと共有パッケージが実装済みなら成功する', async (t) => {
  const f = await fixture(t);
  await f.add('apps/frontend', { source: 'index.tsx' });
  await f.add('apps/backend');
  await f.add('packages/shared');
  await checkWorkspaces(f.root, f.workspaces);
});
