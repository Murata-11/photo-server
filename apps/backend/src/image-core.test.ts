import { beforeAll, afterAll, it, expect } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { processImage, runImageJob } from './image-core.js';
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'image-core-test-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});
async function fixture(name: string, bytes: Buffer) {
  const input = join(dir, name);
  await writeFile(input, bytes);
  return input;
}
it('rotates a tagged JPEG, strips metadata, and retains extraction separately', async () => {
  const input = await fixture(
    'tagged.jpg',
    await sharp({
      create: { width: 64, height: 48, channels: 3, background: '#5ac' },
    })
      .withMetadata({ orientation: 6 })
      .withExif({
        IFD0: { Artist: 'private fixture' },
        IFD2: { DateTimeOriginal: '2026:11:11 16:00:00' },
      })
      .jpeg()
      .toBuffer(),
  );
  const output = join(dir, 'tagged-out.jpg');
  const metadata = await processImage(input, output, 'image/jpeg');
  const info = await sharp(output).metadata();
  expect([info.width, info.height]).toEqual([48, 64]);
  expect(info.exif).toBeUndefined();
  expect(info.icc).toBeUndefined();
  expect(metadata.timeStatus).toBe('succeeded');
});
it('accepts 60MP and rejects over 60MP before saving output', async () => {
  for (const [height, ok] of [
    [6000, true],
    [6001, false],
  ] as const) {
    const input = await fixture(
      `pixels-${height}.png`,
      await sharp({
        create: { width: 10000, height, channels: 3, background: '#5ac' },
      })
        .png()
        .toBuffer(),
    );
    const output = join(dir, `pixels-${height}.jpg`);
    if (ok) {
      await processImage(input, output, 'image/png');
      expect((await sharp(output).metadata()).width).toBe(1600);
    } else
      await expect(
        processImage(input, output, 'image/png'),
      ).rejects.toMatchObject({
        status: 422,
        message: '6,000万画素以下の画像を選んでください',
      });
  }
}, 15000);
it('distinguishes corrupt bytes and MIME spoofing', async () => {
  const invalid = await fixture('broken', Buffer.from('not an image'));
  await expect(
    processImage(invalid, join(dir, 'bad.jpg'), 'image/jpeg'),
  ).rejects.toMatchObject({ status: 422 });
  const png = await fixture(
    'png',
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#5ac' },
    })
      .png()
      .toBuffer(),
  );
  for (const mime of ['image/jpeg', 'image/webp'])
    await expect(
      processImage(png, join(dir, 'spoof.jpg'), mime),
    ).rejects.toMatchObject({
      status: 422,
      message: '画像の形式と内容が一致しません',
    });
});
it('writes bounded result records for worker success and validation failure', async () => {
  const png = await fixture(
    'job.png',
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#5ac' },
    })
      .png()
      .toBuffer(),
  );
  const result = join(dir, 'result.json');
  await runImageJob(png, join(dir, 'job.jpg'), 'image/png', result);
  expect(JSON.parse(await readFile(result, 'utf8')).metadata).toBeDefined();
  await runImageJob(png, join(dir, 'job2.jpg'), 'image/jpeg', result);
  expect(JSON.parse(await readFile(result, 'utf8'))).toMatchObject({
    status: 422,
  });
});
