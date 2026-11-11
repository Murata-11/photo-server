import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('48MP HEICを変換せず追加し、JPEGで閲覧して元バイトを取得する', async ({
  page,
}, info) => {
  const name = `48mp-${info.project.name}-${Date.now()}.heic`;
  const source = await readFile('../backend/test-fixtures/heic/48mp.heic');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const add = () =>
    page
      .getByRole('button', {
        name:
          info.project.name === 'iphone16'
            ? '写真をアップロード'
            : '写真を追加',
        exact: true,
      })
      .first()
      .click();
  await add();
  await expect(page.getByText(/6,000万画素まで/)).toBeVisible();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name, mimeType: 'image/heic', buffer: source });
  const tile = page.getByRole('button', { name: name + 'を開く', exact: true });
  await expect(tile).toBeVisible();
  await page.reload();
  await tile.click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'ダウンロード' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe(name);
  const path = await download.path();
  if (!path) throw new Error('Missing download');
  expect((await readFile(path)).equals(source)).toBe(true);
  await page.goto('/');
  await add();
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.heic',
    mimeType: 'image/heic',
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
