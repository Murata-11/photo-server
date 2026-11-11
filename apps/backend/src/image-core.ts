import sharp from 'sharp';
import exifr from 'exifr';
import { readFile, writeFile } from 'node:fs/promises';
import { normalizeMetadata } from './metadata.js';

const pixels = 60_000_000;
export const imageMessages = {
  pixels: '6,000万画素以下の画像を選んでください',
  corrupt: '画像を読み込めません。破損していない画像を選んでください',
  mismatch: '画像の形式と内容が一致しません',
  multiple: '複数画像・アニメーション・動画には対応していません',
  unsupported: 'JPEG・PNG・WebPの静止画像を選んでください',
  busy: '画像を処理できませんでした。時間をおいて再試行してください',
};
export class ImageError extends Error {
  constructor(
    public readonly status: 415 | 422 | 503,
    message: string,
  ) {
    super(message);
  }
}
export async function processImage(
  input: string,
  output: string,
  mime: string,
) {
  sharp.cache(false);
  sharp.concurrency(1);
  const bytes = await readFile(input);
  try {
    const image = sharp(bytes, { limitInputPixels: pixels, failOn: 'warning' });
    const info = await image.metadata();
    if (!info.width || !info.height)
      throw new ImageError(422, imageMessages.corrupt);
    if (info.width * info.height > pixels)
      throw new ImageError(422, imageMessages.pixels);
    const expected: Record<string, string[]> = {
      jpeg: ['image/jpeg'],
      png: ['image/png'],
      webp: ['image/webp'],
    };
    if (!info.format || !expected[info.format]?.includes(mime))
      throw new ImageError(422, imageMessages.mismatch);
    if ((info.pages ?? 1) > 1)
      throw new ImageError(422, imageMessages.multiple);
    await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toColourspace('srgb')
      .jpeg({ quality: 85 })
      .toFile(output);
  } catch (error) {
    if (error instanceof ImageError) throw error;
    if (error instanceof Error && error.message.includes('pixel limit'))
      throw new ImageError(422, imageMessages.pixels);
    throw new ImageError(422, imageMessages.corrupt);
  }
  try {
    return normalizeMetadata(
      await exifr.parse(bytes, { reviveValues: false, translateValues: false }),
    );
  } catch {
    return {
      timeStatus: 'failed',
      locationStatus: 'failed',
      parserVersion: 'exifr@7.1.3',
    };
  }
}
// Worker writes into a private request directory; never into the library.
export async function runImageJob(
  input: string,
  output: string,
  mime: string,
  result: string,
) {
  try {
    const metadata = await processImage(input, output, mime);
    await writeFile(result, JSON.stringify({ metadata }), { mode: 0o600 });
  } catch (error) {
    const safe =
      error instanceof ImageError
        ? error
        : new ImageError(503, imageMessages.busy);
    await writeFile(
      result,
      JSON.stringify({ status: safe.status, message: safe.message }),
      { mode: 0o600 },
    );
  }
}
