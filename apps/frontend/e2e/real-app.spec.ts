import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('実APIで追加・共有状態・アルバム・再読込・元ファイル・ゴミ箱・復元', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page
    .getByRole('button', {
      name:
        info.project.name === 'iphone16' ? '写真をアップロード' : '写真を追加',
      exact: true,
    })
    .first()
    .click();
  const filename = 'fixture-' + info.project.name + '.jpg';
  const source = await readFile('public/photos/01.jpg');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: filename, mimeType: 'image/jpeg', buffer: source });
  const tile = page.getByRole('button', {
    name: filename + 'を開く',
    exact: true,
  });
  await expect(tile).toBeVisible();
  await page.reload();
  await expect(tile).toBeVisible();
  await tile.click();
  await page
    .getByRole('button', { name: 'お気に入りを切り替え', exact: true })
    .click();
  await expect(
    page.getByText('お気に入りに追加しました', { exact: true }),
  ).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'ダウンロード' }).click();
  const download = await downloaded;
  const path = await download.path();
  expect(path).toBeTruthy();
  if (path) expect(await readFile(path)).toEqual(source);
  expect(download.suggestedFilename()).toBe(filename);
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await page
    .getByRole('link', { name: 'アルバム', exact: true })
    .last()
    .click();
  await page
    .getByRole('button', { name: 'アルバムを作成', exact: true })
    .click();
  const album = '保存アルバム-' + info.project.name + '-' + Date.now();
  await page.getByRole('textbox', { name: 'アルバム名' }).fill(album);
  await page.getByRole('button', { name: '作成する', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: album, exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole('link', { name: 'アルバム', exact: true })
    .last()
    .click();
  await expect(
    page.getByRole('button', { name: new RegExp(album) }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: /^フォト/ })
    .last()
    .click();
  await tile.click();
  await page.getByRole('button', { name: '写真の情報' }).click();
  await page
    .getByRole('combobox', { name: 'アルバムに追加' })
    .selectOption(album);
  await page.getByRole('button', { name: '写真を削除', exact: true }).click();
  await page.getByRole('button', { name: 'ゴミ箱に移動', exact: true }).click();
  await expect(tile).toHaveCount(0);
  // Mobile trash is behind its menu.
  if (info.project.name === 'iphone16')
    await page.getByRole('button', { name: 'メニュー', exact: true }).click();
  await page.getByRole('link', { name: 'ゴミ箱', exact: true }).click();
  await tile.click();
  await page.getByRole('button', { name: '復元', exact: true }).click();
  await page
    .getByRole('link', { name: /^フォト/ })
    .last()
    .click();
  await expect(tile).toBeVisible();
  const search = page.getByRole('textbox', { name: '写真を検索' });
  await search.fill(filename);
  await expect(tile).toBeVisible();
  await search.fill('no-such-photo-name');
  await expect(
    page.getByRole('heading', { name: '写真が見つかりませんでした' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: '../../work/' + info.project.name + '-real-app.png',
    fullPage: true,
  });
});
