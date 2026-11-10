import assert from 'node:assert/strict';
import console from 'node:console';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

// Exercise the narrow exception with the same pinned scanner as CI.
// Tokens are generated fixtures, never usable credentials.
const binary = process.argv[2];
assert.ok(binary, 'Pass the Gitleaks executable path');
const root = await mkdtemp(join(tmpdir(), 'photo-gitleaks-'));
try {
  const bundle = join(root, 'storybook/assets/iframe-fixture.js');
  await mkdir(join(root, 'storybook/assets'), { recursive: true });
  const scan = () =>
    spawnSync(
      binary,
      [
        'dir',
        '--redact',
        '--no-banner',
        '--config',
        resolve('.gitleaks.toml'),
        root,
      ],
      { encoding: 'utf8' },
    );
  await writeFile(bundle, 'e.key,o=e.childrens;\n');
  assert.equal(scan().status, 0, 'Known bundle expression must be accepted');
  await writeFile(join(root, 'source.js'), 'e.key,o=e.childrens;\n');
  assert.equal(
    scan().status,
    1,
    'Exception must not apply to unrelated source files',
  );
  await rm(join(root, 'source.js'));
  await writeFile(
    bundle,
    `const credential = "${'gh' + 'p_'}${randomBytes(18).toString('hex')}";\n`,
  );
  assert.equal(
    scan().status,
    1,
    'Credential detection must stay enabled in the same bundle',
  );
  console.log(
    'Gitleaks: bundle exception is narrow and credential detection is enabled.',
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
