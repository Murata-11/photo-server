import { Buffer, File } from 'node:buffer';
import console from 'node:console';
// Run only against an isolated test app. Never reads or mutates existing photos.
import assert from 'node:assert/strict';
import process from 'node:process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { URL } from 'node:url';
const require = createRequire(new URL('../package.json', import.meta.url));
const sharp = require('sharp');
const base = new URL(process.env.UPLOAD_TEST_URL ?? 'http://127.0.0.1:34020');
assert(
  ['127.0.0.1', 'localhost'].includes(base.hostname),
  'Isolated loopback test app required',
);
const records = [];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function upload(bytes, name, mime, status = 200) {
  const form = new globalThis.FormData();
  form.append('file', new File([bytes], name, { type: mime }));
  const start = performance.now();
  const response = await globalThis.fetch(new URL('/api/photos', base), {
    method: 'POST',
    headers: { Origin: base.origin, 'X-Photo-Request': '1' },
    body: form,
  });
  const result = await response.json();
  records.push({
    name,
    status: response.status,
    milliseconds: Math.round(performance.now() - start),
  });
  assert.equal(response.status, status, name + ': ' + JSON.stringify(result));
  if (status !== 200) return result;
  const original = await globalThis.fetch(new URL(result.originalUrl, base));
  assert.equal(original.headers.get('content-type'), mime);
  assert.equal(hash(Buffer.from(await original.arrayBuffer())), hash(bytes));
  assert(
    original.headers
      .get('content-disposition')
      .includes(encodeURIComponent(name)),
  );
  const thumbnail = Buffer.from(
    await (await globalThis.fetch(new URL(result.src, base))).arrayBuffer(),
  );
  const info = await sharp(thumbnail).metadata();
  assert.equal(info.format, 'jpeg');
  assert(Math.max(info.width, info.height) <= 1600);
  assert.equal(info.exif, undefined);
  assert.equal(info.icc, undefined);
  return { ...result, thumbnail, info, hash: hash(bytes) };
}
if (process.argv.includes('--verify-restart')) {
  const saved = JSON.parse(
    await readFile('work/upload-persistence.json', 'utf8'),
  );
  const list = await (
    await globalThis.fetch(new URL('/api/photos', base))
  ).json();
  assert(list.some((p) => p.id === saved.id));
  assert.equal(
    hash(
      Buffer.from(
        await (
          await globalThis.fetch(new URL(saved.originalUrl, base))
        ).arrayBuffer(),
      ),
    ),
    saved.hash,
  );
  console.log('48MP list and original persisted after restart');
} else {
  const images = {};
  for (const format of ['jpeg', 'png', 'webp']) {
    const generated = sharp({
      create: { width: 8064, height: 6048, channels: 3, background: '#55aacc' },
    });
    images[format] = await generated[format]().toBuffer();
    const result = await upload(
      images[format],
      '48mp.' + format,
      'image/' + format,
    );
    if (format === 'jpeg') {
      await mkdir('work', { recursive: true });
      await writeFile(
        'work/upload-persistence.json',
        JSON.stringify({
          id: result.id,
          originalUrl: result.originalUrl,
          hash: result.hash,
        }),
      );
    }
  }
  for (const [height, status] of [
    [6000, 200],
    [6001, 422],
  ]) {
    const bytes = await sharp({
      create: { width: 10000, height, channels: 3, background: '#55aacc' },
    })
      .jpeg()
      .toBuffer();
    const result = await upload(
      bytes,
      'pixels-' + height + '.jpg',
      'image/jpeg',
      status,
    );
    if (status === 422)
      assert.equal(result.message, '6,000万画素以下の画像を選んでください');
  }
  const exact = Buffer.alloc(50 * 1024 * 1024);
  images.jpeg.copy(exact);
  await upload(exact, '48mp-50mib.jpg', 'image/jpeg');
  await upload(
    Buffer.alloc(50 * 1024 * 1024 + 1),
    'oversize.jpg',
    'image/jpeg',
    413,
  );
  for (const mime of ['image/heic', 'image/heif', 'image/avif']) {
    const result = await upload(
      Buffer.from('unsupported fixture'),
      'unsupported.img',
      mime,
      415,
    );
    assert.equal(result.message, 'JPEG・PNG・WebPの静止画像を選んでください');
  }
  await upload(Buffer.from('broken fixture'), 'broken.jpg', 'image/jpeg', 422);
  await upload(images.png, 'fake.jpg', 'image/jpeg', 422);
  const concurrent = await Promise.all(
    [0, 1, 2, 3].map(async (i) => {
      const form = new globalThis.FormData();
      form.append(
        'file',
        new File([images.jpeg], `concurrent-${i}.jpg`, { type: 'image/jpeg' }),
      );
      return (
        await globalThis.fetch(new URL('/api/photos', base), {
          method: 'POST',
          headers: { Origin: base.origin, 'X-Photo-Request': '1' },
          body: form,
        })
      ).status;
    }),
  );
  assert.deepEqual(concurrent.sort(), [200, 200, 200, 503]);
  records.push({ name: 'overload-4', statuses: concurrent });
  await upload(images.jpeg, 'after-errors.jpg', 'image/jpeg');
  console.log(JSON.stringify(records, null, 2));
}
