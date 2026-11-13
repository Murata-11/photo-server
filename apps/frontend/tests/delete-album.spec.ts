import { test, expect, type Page } from '@playwright/test';

function storyUrl(width: number, mode = 'normal') {
  const id =
    width === 1440
      ? 'pc-デスクトップ--playground'
      : 'スマートフォン-iphone-16--playground';
  return `/iframe.html?id=${encodeURIComponent(id)}&viewMode=story&smartphoneCanvas=1&desktopCanvas=1&albumDeletion=${mode}`;
}
async function openAlbum(page: Page) {
  await page.getByRole('link', { name: 'アルバム', exact: true }).click();
  await page.locator('.album-card').filter({ hasText: '秋の小旅行' }).click();
  await page
    .getByRole('button', { name: 'アルバムを削除', exact: true })
    .click();
}
for (const width of [320, 393, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`アルバム削除とキャンセル・写真保持 ${width} ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 852 });
      await page.emulateMedia({ colorScheme });
      await page.goto(storyUrl(width));
      await expect(page.locator('.photo-tile').first()).toBeVisible({
        timeout: 20000,
      });
      const before = await page.evaluate(async () =>
        (await fetch('/api/photos')).json(),
      );
      await openAlbum(page);
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('「秋の小旅行」')).toBeVisible();
      await expect(dialog.getByText(/写真は削除されません/)).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'キャンセル' }),
      ).toBeFocused();
      expect(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      expect(
        await dialog.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return Array.from(element.querySelectorAll('button')).every(
            (button) => {
              const rect = button.getBoundingClientRect();
              return rect.left >= bounds.left && rect.right <= bounds.right;
            },
          );
        }),
      ).toBe(true);
      await page.screenshot({
        path: `../../work/delete-album-${width}-${colorScheme}.png`,
      });
      await dialog.getByRole('button', { name: 'キャンセル' }).click();
      expect(
        await page.evaluate(async () => (await fetch('/api/photos')).json()),
      ).toEqual(before);
      await page
        .getByRole('button', { name: 'アルバムを削除', exact: true })
        .click();
      await dialog.getByRole('button', { name: 'このアルバムを削除' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(
        page.locator('.album-card').filter({ hasText: '秋の小旅行' }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(async () => (await fetch('/api/photos')).json()),
      ).toEqual(
        before.map((photo: { albums: string[] }) => ({
          ...photo,
          albums: photo.albums.filter((name) => name !== '秋の小旅行'),
        })),
      );
      await page.getByRole('link', { name: 'フォト', exact: true }).click();
      await expect(page.locator('.photo-tile')).toHaveCount(before.length);
    });
  }
}
for (const mode of ['saving', 'error', 'unknown', 'refresh']) {
  test(`アルバム削除の${mode}状態を操作できる`, async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(storyUrl(393, mode));
    await expect(page.locator('.photo-tile').first()).toBeVisible({
      timeout: 20000,
    });
    let deletes = 0;
    page.on('request', (request) => {
      if (
        request.method() === 'DELETE' &&
        request.url().endsWith('/api/albums')
      )
        deletes++;
    });
    await openAlbum(page);
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'このアルバムを削除' }).click();
    if (mode === 'saving') {
      await expect(dialog.getByRole('status')).toContainText('削除しています');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'キャンセル' }),
      ).toBeDisabled();
    } else if (mode === 'refresh') {
      await expect(dialog.getByRole('alert')).toContainText('削除は完了');
      await dialog.getByRole('button', { name: '再取得' }).click();
      await expect(dialog).toHaveCount(0);
    } else {
      await expect(dialog.getByRole('alert')).toContainText('結果が不明');
      await dialog.getByRole('button', { name: '削除結果を確認' }).click();
      if (mode === 'error') {
        await expect(dialog.getByRole('alert')).toContainText(
          '作り直された可能性',
        );
        expect(deletes).toBe(1);
        await dialog
          .getByRole('button', { name: 'このアルバムを削除' })
          .click();
      }
      await expect(dialog).toHaveCount(0);
    }
    expect(deletes).toBe(mode === 'error' ? 2 : 1);
  });
}
test('空のアルバムをキーボードで作成・削除できる', async ({ page }) => {
  await page.goto(storyUrl(1440));
  await expect(page.locator('.photo-tile').first()).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole('link', { name: 'アルバム', exact: true }).click();
  await page
    .getByRole('button', { name: 'アルバムを作成', exact: true })
    .click();
  await page.getByRole('textbox').fill('空のアルバム / ..');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '作成する', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '空のアルバム / ..', exact: true }),
  ).toBeVisible();
  const trigger = page.getByRole('button', {
    name: 'アルバムを削除',
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'このアルバムを削除' })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.locator('.album-card').filter({ hasText: '空のアルバム / ..' }),
  ).toHaveCount(0);
});
