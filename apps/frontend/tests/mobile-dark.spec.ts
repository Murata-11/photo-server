import { test, expect } from '@playwright/test';
const story = (name = 'photos') =>
  '/iframe.html?id=' +
  encodeURIComponent('デザイン提案-モバイルダーク--' + name) +
  '&viewMode=story';
test('ダークUIをスマホで操作し、アルバム・作成・詳細を確認する', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(story());
  await expect(
    page.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveClass(/mobile-dark/);
  await expect(page.locator('.main-content > .page-heading')).toHaveCount(0);
  await expect(page.locator('.gallery-toolbar')).toHaveCount(0);
  await expect(page.locator('.date-heading').first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator('.photo-grid')
      .first()
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
      ),
  ).toBe(3);
  await page.screenshot({
    path: '../../work/mobile-dark-photos.png',
    fullPage: false,
    style: '[data-sonner-toaster] { visibility: hidden; }',
  });
  const nav = page.getByRole('navigation', { name: 'メインナビゲーション' });
  await nav.getByRole('link', { name: 'アルバム', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'アルバム', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: '../../work/mobile-dark-albums.png',
    fullPage: false,
    style: '[data-sonner-toaster] { visibility: hidden; }',
  });
  await page.getByRole('button', { name: /秋の小旅行/ }).click();
  await expect(
    page.getByRole('heading', { name: '秋の小旅行', exact: true }),
  ).toBeVisible();
  await nav.getByRole('button', { name: '作成', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'アルバム名', exact: true })
    .fill('ふたりの冬');
  await page.getByRole('button', { name: '作成する', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'ふたりの冬', exact: true }),
  ).toBeVisible();
  await nav.getByRole('link', { name: 'フォト', exact: true }).click();
  await page
    .getByRole('button', { name: '湖畔の朝を開く', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '湖畔の朝', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: '../../work/mobile-dark-detail.png',
    fullPage: false,
    style: '[data-sonner-toaster] { visibility: hidden; }',
  });
  await page
    .getByRole('button', { name: '写真をアップロード', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
});
test('ダークUIの空・失敗・読み込み状態とPC幅を表示する', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  for (const [name, heading] of [
    ['empty', 'まだ写真がありません'],
    ['error', '写真を読み込めませんでした'],
    ['loading', '写真を読み込んでいます'],
  ]) {
    await page.goto(story(name));
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(story());
  await expect(
    page.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('専用iPhoneプレビューと320px幅でナビと最後の写真を確認する', async ({
  page,
}) => {
  await page.goto(story('i-phone-16'));
  const phone = page.frameLocator('iframe[title="iPhone 16の写真アプリ"]');
  await expect(phone.locator('.mobile-dark')).toBeVisible();
  await expect(
    phone.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(story());
  await expect(
    page.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const last = page.locator('.photo-tile').last();
  await last.scrollIntoViewIfNeeded();
  const photo = await last.boundingBox();
  const nav = await page.locator('.mobile-bottom-nav').boundingBox();
  expect(photo && nav && photo.y + photo.height <= nav.y).toBeTruthy();
});
