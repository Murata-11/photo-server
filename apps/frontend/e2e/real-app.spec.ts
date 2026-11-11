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
  await page
    .getByRole('button', { name: 'アルバムに追加・解除', exact: true })
    .click();
  const check = page.getByRole('checkbox', { name: album, exact: true });
  await check.click();
  await expect(check).toBeEnabled();
  await expect(check).toBeChecked();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await page
    .getByRole('link', { name: 'アルバム', exact: true })
    .last()
    .click();
  await page
    .getByRole('button', { name: 'アルバムを作成', exact: true })
    .click();
  const otherAlbum = album + '-別所属';
  await page.getByRole('textbox', { name: 'アルバム名' }).fill(otherAlbum);
  await page.getByRole('button', { name: '作成する', exact: true }).click();
  await page
    .getByRole('link', { name: /^フォト/ })
    .last()
    .click();
  await tile.click();
  await page
    .getByRole('button', { name: 'アルバムに追加・解除', exact: true })
    .click();
  const secondCheck = page.getByRole('checkbox', {
    name: otherAlbum,
    exact: true,
  });
  await secondCheck.click();
  await expect(secondCheck).toBeEnabled();
  await expect(secondCheck).toBeChecked();
  await expect(check).toBeChecked();
  await check.click();
  await expect(check).toBeEnabled();
  await expect(check).not.toBeChecked();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.reload();
  await tile.click();
  await page
    .getByRole('button', { name: 'アルバムに追加・解除', exact: true })
    .click();
  await expect(check).not.toBeChecked();
  await expect(secondCheck).toBeChecked();
  await check.click();
  await expect(check).toBeEnabled();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: '写真を削除', exact: true }).click();
  await page.getByRole('button', { name: 'ゴミ箱に移動', exact: true }).click();
  await expect(tile).toHaveCount(0);
  // Mobile trash is behind its menu.
  if (info.project.name === 'iphone16')
    await page.getByRole('button', { name: 'メニュー', exact: true }).click();
  await page.getByRole('link', { name: 'ゴミ箱', exact: true }).click();
  await tile.click();
  await page
    .getByRole('button', { name: 'アルバムに追加・解除', exact: true })
    .click();
  await expect(check).toBeChecked();
  await expect(secondCheck).toBeChecked();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: '復元', exact: true }).click();
  await page
    .getByRole('link', { name: /^フォト/ })
    .last()
    .click();
  await expect(tile).toBeVisible();
  await page
    .getByRole('link', { name: 'アルバム', exact: true })
    .last()
    .click();
  for (const name of [album, otherAlbum]) {
    const card = page
      .getByRole('button', { name: new RegExp(name) })
      .filter({ has: page.getByRole('heading', { name, exact: true }) });
    await expect(card).toContainText('1枚の写真');
    await expect(card.locator('img')).toHaveCount(1);
    await card.click();
    await expect(tile).toBeVisible();
    await page
      .getByRole('link', { name: 'アルバム', exact: true })
      .last()
      .click();
  }
  await page
    .getByRole('link', { name: /^フォト/ })
    .last()
    .click();
  await expect(page.getByRole('textbox', { name: '写真を検索' })).toHaveCount(
    0,
  );
  await expect(tile).toBeVisible();
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
