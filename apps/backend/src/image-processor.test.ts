import { beforeAll, afterAll, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImageProcessor } from './image-processor.js';
let dir: string, worker: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'image-runner-test-'));
  worker = join(dir, 'worker.cjs');
  await writeFile(
    worker,
    `
const fs = require('node:fs');
const path = require('node:path');
const [input, output, mime, result] = process.argv.slice(2);
if (mime === 'hang') setInterval(() => {}, 1000);
else setTimeout(() => {
  fs.writeFileSync(output, 'jpeg-result');
  fs.writeFileSync(result, JSON.stringify(mime === 'invalid' ? {status:422,message:'fixture rejection'} : {metadata:{inputDir:path.dirname(input)}}));
}, mime === 'slow' ? 150 : 0);
`,
  );
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});
it('bounds the queue to one active and two waiting, then drains without dropping jobs', async () => {
  const processor = new ImageProcessor({ worker });
  const jobs = ['slow', 'normal', 'normal'].map((mime) =>
    processor.process(Buffer.from('fixture'), mime),
  );
  await expect(
    processor.process(Buffer.from('fixture'), 'normal'),
  ).rejects.toMatchObject({ status: 503 });
  const responses = await Promise.all(jobs);
  for (const response of responses) {
    expect(response.thumbnail.toString()).toBe('jpeg-result');
    await expect(
      access(response.metadata.inputDir as string),
    ).rejects.toThrow();
  }
  expect(
    (
      await processor.process(Buffer.from('fixture'), 'normal')
    ).thumbnail.toString(),
  ).toBe('jpeg-result');
});
it('kills a timed out worker, releases its slot and processes the next job', async () => {
  const processor = new ImageProcessor({ worker, timeoutMs: 150 });
  const hung = processor.process(Buffer.from('fixture'), 'hang');
  const next = processor.process(Buffer.from('fixture'), 'normal');
  await expect(hung).rejects.toMatchObject({ status: 503 });
  expect((await next).thumbnail.toString()).toBe('jpeg-result');
});
it('reports safe validation failures and unexpected worker termination', async () => {
  await expect(
    new ImageProcessor({ worker }).process(Buffer.from('fixture'), 'invalid'),
  ).rejects.toMatchObject({ status: 422, message: 'fixture rejection' });
  await expect(
    new ImageProcessor({ worker: join(dir, 'missing.cjs') }).process(
      Buffer.from('fixture'),
      'normal',
    ),
  ).rejects.toMatchObject({ status: 503 });
});
