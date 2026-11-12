import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('48MP JPEGを追加・閲覧して元バイトを取得しHEIFは拒否する', async ({
  page,
}, info) => {
  const name = `48mp-${info.project.name}-${Date.now()}.jpg`;
  const source = await readFile('../backend/test-fixtures/48mp.jpg');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const add = () =>
    page
      .getByRole('button', {
        name: '写真をアップロード',
        exact: true,
      })
      .first()
      .click();
  await add();
  await expect(page.getByText(/6,000万画素まで/)).toBeVisible();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name, mimeType: 'image/jpeg', buffer: source });
  const tile = page.getByRole('button', { name: name + 'を開く', exact: true });
  await expect(tile).toBeVisible();
  await page.reload();
  await tile.click();
  const detailImage = page.locator('.detail-image');
  await expect(detailImage).toHaveAttribute(
    'src',
    /\/original\?disposition=inline$/,
  );
  await expect
    .poll(
      () =>
        detailImage.evaluate(
          (element: HTMLImageElement) => element.naturalWidth,
        ),
      { timeout: 15000 },
    )
    .toBeGreaterThan(1600);
  await page.getByRole('button', { name: '写真に保存', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'ダウンロード' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe(name);
  const path = await download.path();
  if (!path) throw new Error('Missing download');
  expect((await readFile(path)).equals(source)).toBe(true);
  await page.goto('/');
  await add();
  for (const mime of ['image/heic', 'image/heif']) {
    await page.goto('/');
    await add();
    await page.locator('input[type=file]').setInputFiles({
      name: 'unsupported.heif',
      mimeType: mime,
      buffer: Buffer.from('unsupported fixture'),
    });
    await expect(
      page.getByText('JPEG・PNG・WebPの静止画像を選んでください', {
        exact: true,
      }),
    ).toBeVisible();
  }
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('broken fixture'),
  });
  await expect(
    page.getByText('画像を読み込めません。破損していない画像を選んでください', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
