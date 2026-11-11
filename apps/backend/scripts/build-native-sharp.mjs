import process from 'node:process';
import { URL } from 'node:url';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, copyFileSync } from 'node:fs';
const require = createRequire(new URL('../package.json', import.meta.url));
const root = dirname(dirname(require.resolve('sharp')));
if (process.argv[2]) {
  const targetRequire = createRequire(join(process.argv[2], 'package.json'));
  const target = join(
    dirname(dirname(targetRequire.resolve('sharp'))),
    'src/build/Release',
  );
  mkdirSync(target, { recursive: true });
  for (const file of readdirSync(join(root, 'src/build/Release'))) {
    if (file.endsWith('.node'))
      copyFileSync(join(root, 'src/build/Release', file), join(target, file));
  }
} else {
  require.resolve('node-addon-api');
  require.resolve('node-gyp');
  execFileSync(process.execPath, ['install/build.js'], {
    cwd: root,
    stdio: 'inherit',
  });
}
const sharp = process.argv[2]
  ? createRequire(join(process.argv[2], 'package.json'))('sharp')
  : require('sharp');
if (sharp.versions.heif !== undefined || sharp.versions.vips !== '8.18.7') {
  throw new Error('Custom HEVC decoder was not linked');
}
