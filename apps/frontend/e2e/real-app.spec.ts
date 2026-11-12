import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function expectNoSearchLayout(page: Page) {
  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '写真を検索' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: '検索をクリア' })).toHaveCount(
    0,
  );
  const header = await page.locator('.topbar').boundingBox();
  const contentTop = await page
    .locator('.main-content')
    .evaluate(
      (element) => element.getBoundingClientRect().top + window.scrollY,
    );
  expect(header?.height).toBe(
    (page.viewportSize()?.width ?? 0) <= 760 ? 84 : 72,
  );
  await expect(page.locator('.app-shell')).toHaveClass(/mobile-dark/);
  await expect(page.locator('#library-menu')).toHaveCount(0);
  expect(contentTop).toBeGreaterThanOrEqual(72);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test('実APIで追加・共有状態・アルバム・再読込・元ファイル・ゴミ箱・復元', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expectNoSearchLayout(page);
  await page
    .getByRole('button', {
      name: '写真をアップロード',
      exact: true,
    })
    .first()
    .click();
  const filename = `fixture-${info.project.name}-${Date.now()}.jpg`;
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
  await expectNoSearchLayout(page);
  await expect(tile).toBeVisible();
  await expect(page.locator('.photo-select')).toHaveCount(0);
  if (info.project.name === 'iphone16') {
    const box = await tile.boundingBox();
    if (!box) throw new Error('Missing photo');
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    await expect(
      page.getByRole('status', { name: '1枚を選択中' }),
    ).toBeVisible();
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await touch.detach();
  } else {
    await tile.press('Shift+Enter');
    await expect(
      page.getByRole('status', { name: '1枚を選択中' }),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: '選択解除' }).click();
  await tile.click();
  await expectNoSearchLayout(page);
  await page
    .getByRole('button', { name: 'お気に入りを切り替え', exact: true })
    .click();
  await expect(
    page.getByText('お気に入りに追加しました', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '写真に保存', exact: true }).click();
  const previewResponse = page
    .context()
    .waitForEvent(
      'response',
      (response) =>
        response.url().includes('disposition=inline') &&
        response.request().isNavigationRequest(),
    );
  const opened = page.waitForEvent('popup');
  await page.getByRole('link', { name: '元画像をプレビュー' }).click();
  const preview = await opened;
  const response = await previewResponse;
  expect(response.status()).toBe(200);
  expect(response.headers()['content-disposition']).toMatch(/^inline;/);
  expect(response.headers()['content-type']).toBe('image/jpeg');
  expect(await response.body()).toEqual(source);
  await expect(preview.locator('img')).toBeVisible();
  await preview.close();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'ダウンロード' }).click();
  const download = await downloaded;
  const path = await download.path();
  expect(path).toBeTruthy();
  if (path) expect(await readFile(path)).toEqual(source);
  expect(download.suggestedFilename()).toBe(filename);
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
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
  await expectNoSearchLayout(page);
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
  await expectNoSearchLayout(page);
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
  await expectNoSearchLayout(page);
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
  await expectNoSearchLayout(page);
  await tile.click();
  await expectNoSearchLayout(page);
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
  await page
    .getByRole('button', { name: 'アカウントメニュー', exact: true })
    .click();
  await page.getByRole('link', { name: 'ゴミ箱', exact: true }).click();
  await expectNoSearchLayout(page);
  await tile.click();
  await expectNoSearchLayout(page);
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
  await expectNoSearchLayout(page);
  for (const name of [album, otherAlbum]) {
    const card = page
      .getByRole('button', { name: new RegExp(name) })
      .filter({ has: page.getByRole('heading', { name, exact: true }) });
    await expect(card).toContainText('1枚の写真');
    await expect(card.locator('img')).toHaveCount(1);
    await card.click();
    await expectNoSearchLayout(page);
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
