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
const base = new URL(process.env.HEIC_TEST_URL ?? 'http://127.0.0.1:34020');
assert(
  ['127.0.0.1', 'localhost'].includes(base.hostname),
  'Isolated loopback test app required',
);
const records = [];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fixtures = new URL('../test-fixtures/heic/', import.meta.url);
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
    await readFile('work/heic-persistence.json', 'utf8'),
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
  console.log('HEIC list and original persisted after restart');
} else {
  for (const name of [
    'tiny',
    '48mp',
    '60mp',
    'ten-bit',
    'alpha',
    'orientation',
    'rotated',
    'mirrored',
  ]) {
    const bytes = await readFile(new URL(name + '.heic', fixtures));
    const result = await upload(bytes, name + '.heic', 'image/heic');
    if (name === 'rotated' || name === 'mirrored') {
      assert.deepEqual(
        [result.info.width, result.info.height],
        name === 'rotated' ? [48, 64] : [64, 48],
      );
      const { data, info } = await sharp(result.thumbnail)
        .raw()
        .toBuffer({ resolveWithObject: true });
      const offset = (8 * info.width + 8) * info.channels;
      const rgb = [...data.subarray(offset, offset + 3)];
      const expected = name === 'rotated' ? [0, 0, 255] : [0, 255, 0];
      rgb.forEach((value, i) =>
        assert(
          Math.abs(value - expected[i]) < 45,
          `orientation ${name}: ${rgb}`,
        ),
      );
    }
    if (name === '48mp') {
      await mkdir('work', { recursive: true });
      await writeFile(
        'work/heic-persistence.json',
        JSON.stringify({
          id: result.id,
          originalUrl: result.originalUrl,
          hash: result.hash,
        }),
      );
    }
  }
  const tiny = await readFile(new URL('tiny.heic', fixtures));
  await upload(tiny, 'alternate.heif', 'image/heif');
  await upload(
    await readFile(new URL('multiple.heic', fixtures)),
    'multiple.heic',
    'image/heic',
    422,
  );
  const bad = await upload(
    tiny.subarray(0, 70),
    'broken.heic',
    'image/heic',
    422,
  );
  assert.equal(
    bad.message,
    '画像を読み込めません。破損していない画像を選んでください',
  );
  for (const format of ['jpeg', 'png', 'webp']) {
    const generated = sharp({
      create: { width: 8064, height: 6048, channels: 3, background: '#55aacc' },
    });
    const image = await generated[format]().toBuffer();
    await upload(image, '48mp.' + format, 'image/' + format);
    if (format === 'jpeg') {
      const mismatch = await upload(image, 'fake.heic', 'image/heic', 422);
      assert.equal(mismatch.message, '画像の形式と内容が一致しません');
    }
  }
  for (const [height, status] of [
    [6000, 200],
    [6001, 422],
  ]) {
    const image = await sharp({
      create: { width: 10000, height, channels: 3, background: '#55aacc' },
    })
      .jpeg()
      .toBuffer();
    const result = await upload(
      image,
      'pixels-' + height + '.jpg',
      'image/jpeg',
      status,
    );
    if (status === 422)
      assert.equal(result.message, '6,000万画素以下の画像を選んでください');
  }
  const avif = await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#55aacc' },
  })
    .avif()
    .toBuffer();
  // Lie about both MIME and the major brand. Item codec inspection must still reject AV1.
  Buffer.from('heic').copy(avif, 8);
  const wrongCodec = await upload(avif, 'codec-spoof.heic', 'image/heic', 415);
  assert.equal(
    wrongCodec.message,
    'JPEG・PNG・WebP・HEICの静止画像を選んでください',
  );
  const tooManyPixels = await upload(
    await readFile(new URL('over60mp.heic', fixtures)),
    'over60mp.heic',
    'image/heic',
    422,
  );
  assert.equal(tooManyPixels.message, '6,000万画素以下の画像を選んでください');
  for (const name of ['video.mp4', 'with-video.heic'])
    await upload(
      await readFile(new URL(name, fixtures)),
      name,
      'image/heic',
      422,
    );
  const exactLimit = Buffer.alloc(50 * 1024 * 1024);
  (
    await sharp({
      create: { width: 8064, height: 6048, channels: 3, background: '#55aacc' },
    })
      .jpeg()
      .toBuffer()
  ).copy(exactLimit);
  await upload(exactLimit, '48mp-50mib.jpg', 'image/jpeg');
  const large = Buffer.alloc(50 * 1024 * 1024 + 1);
  await upload(large, 'oversize.heic', 'image/heic', 413);
  // Three simultaneous uploads must succeed serially; the fourth may be refused if the slots are full.
  const concurrent = await Promise.all(
    [0, 1, 2].map((i) => upload(tiny, `concurrent-${i}.heic`, 'image/heic')),
  );
  assert.equal(concurrent.length, 3);
  const stress = await readFile(new URL('48mp.heic', fixtures));
  const overloaded = await Promise.all(
    [0, 1, 2, 3].map(async (i) => {
      const form = new globalThis.FormData();
      form.append(
        'file',
        new File([stress], `overload-${i}.heic`, { type: 'image/heic' }),
      );
      const response = await globalThis.fetch(new URL('/api/photos', base), {
        method: 'POST',
        headers: { Origin: base.origin, 'X-Photo-Request': '1' },
        body: form,
      });
      return response.status;
    }),
  );
  assert.deepEqual(overloaded.sort(), [200, 200, 200, 503]);
  records.push({ name: 'overload-4', statuses: overloaded });
  await upload(tiny, 'after-errors.heic', 'image/heic');
  console.log(JSON.stringify(records, null, 2));
}
