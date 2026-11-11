import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  symlink,
  access,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  previewPath,
  updatePreview,
  validateArtifact,
} from './review-pages.mjs';

const sha = 'a'.repeat(40);
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'review-pages-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const artifact = join(root, 'artifact');
  for (const file of [
    'index.html',
    'storybook/index.html',
    'api/index.html',
    'api/openapi.yaml',
  ]) {
    await mkdir(join(artifact, file, '..'), { recursive: true });
    await writeFile(join(artifact, file), 'fixture');
  }
  const site = join(root, 'site');
  await mkdir(site);
  return { root: site, artifact, number: 10, sha };
}

test('PR番号のパストラバーサルを拒否する', () => {
  for (const value of ['../main', '10', 0, -1, NaN]) {
    assert.throws(() => previewPath(value));
  }
});

test('PR更新と削除で他のPRを保持し、SHAを表示する', async (t) => {
  const f = await fixture(t);
  await updatePreview(f);
  await updatePreview({ ...f, number: 11 });
  await updatePreview({ ...f, sha: 'b'.repeat(40) });
  assert.match(
    await readFile(join(f.root, 'pr/10/revision.html'), 'utf8'),
    /b{40}/,
  );
  await access(join(f.root, 'pr/11/index.html'));
  await updatePreview({ ...f, remove: true });
  await assert.rejects(access(join(f.root, 'pr/10')));
  assert.doesNotMatch(
    await readFile(join(f.root, 'index.html'), 'utf8'),
    /PR #10/,
  );
  await access(join(f.root, 'pr/11/index.html'));
});

test('成果物のシンボリックリンク・隠しパス・欠落を拒否する', async (t) => {
  const f = await fixture(t);
  await symlink('/etc/passwd', join(f.artifact, 'link'));
  await assert.rejects(validateArtifact(f.artifact), /Symlinks/);
  await rm(join(f.artifact, 'link'));
  await mkdir(join(f.artifact, '.git'));
  await assert.rejects(validateArtifact(f.artifact), /Hidden/);
  await rm(join(f.artifact, '.git'), { recursive: true });
  await rm(join(f.artifact, 'api/openapi.yaml'));
  await assert.rejects(validateArtifact(f.artifact));
});

test('公開更新後も開いたままの旧画面が参照するJS・CSSを保持する', async (t) => {
  const f = await fixture(t);
  const assets = join(f.artifact, 'storybook/assets');
  await mkdir(assets, { recursive: true });
  await writeFile(join(assets, 'story-oldhash.js'), 'old story');
  await writeFile(join(assets, 'style-oldhash.css'), 'old style');
  await writeFile(join(assets, 'shared.js'), 'old shared');
  await updatePreview(f);
  await rm(assets, { recursive: true });
  await mkdir(assets);
  await writeFile(join(assets, 'story-newhash.js'), 'new story');
  await writeFile(join(assets, 'shared.js'), 'new shared');
  await writeFile(join(f.artifact, 'storybook/index.html'), 'new index');
  await updatePreview({ ...f, sha: 'b'.repeat(40) });
  const published = join(f.root, 'pr/10/storybook');
  assert.equal(
    await readFile(join(published, 'assets/story-oldhash.js'), 'utf8'),
    'old story',
  );
  assert.equal(
    await readFile(join(published, 'assets/style-oldhash.css'), 'utf8'),
    'old style',
  );
  assert.equal(
    await readFile(join(published, 'assets/story-newhash.js'), 'utf8'),
    'new story',
  );
  assert.equal(
    await readFile(join(published, 'index.html'), 'utf8'),
    'new index',
  );
  assert.equal(
    await readFile(join(published, 'assets/shared.js'), 'utf8'),
    'new shared',
  );
  await updatePreview({ ...f, remove: true });
  await assert.rejects(access(published));
});

test('旧assets結合後の検証失敗では公開中のHTMLを変更しない', async (t) => {
  const f = await fixture(t);
  await updatePreview(f);
  const published = join(f.root, 'pr/10/storybook');
  await mkdir(join(published, 'assets'));
  await symlink('/etc/passwd', join(published, 'assets/invalid.js'));
  await writeFile(join(f.artifact, 'storybook/index.html'), 'new index');
  await assert.rejects(
    updatePreview({ ...f, sha: 'b'.repeat(40) }),
    /Symlinks/,
  );
  assert.equal(
    await readFile(join(published, 'index.html'), 'utf8'),
    'fixture',
  );
});
