import { test, expect } from '@playwright/test';
const phoneId = 'スマートフォン-iphone-16--playground';
const story =
  './iframe.html?id=' + encodeURIComponent(phoneId) + '&viewMode=story';
test('iPhoneプレビューは読み込み停止を通知し、再読み込みで復帰する', async ({
  page,
}) => {
  let blocked = true;
  await page.route('**/iframe.html?**', async (route) => {
    const url = new URL(route.request().url());
    if (blocked && url.searchParams.get('id') === 'アプリ-ひより--playground')
      await route.abort();
    else await route.continue();
  });
  await page.goto(story);
  await expect(page.getByRole('status')).toContainText(
    'プレビューを読み込んでいます',
  );
  await expect(page.getByRole('alert')).toContainText(
    'プレビューを読み込めませんでした',
    { timeout: 20000 },
  );
  await expect(
    page.getByRole('link', { name: '画面を直接開く' }),
  ).toHaveAttribute('href', /iframe.html/);
  blocked = false;
  await page.getByRole('button', { name: '再読み込み', exact: true }).click();
  const frame = page.frameLocator('iframe[title="iPhone 16の写真アプリ"]');
  await expect(
    frame.getByRole('button', { name: '湖畔の朝を選択', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveCount(0);
  await frame
    .getByRole('button', { name: '湖畔の朝を選択', exact: true })
    .click();
  await frame
    .getByRole('button', { name: '山へ続く道を選択', exact: true })
    .click();
  await expect(frame.getByText('2枚を選択中')).toBeVisible();
});
test('StorybookのメニューからiPhoneプレビューを表示して詳細を開く', async ({
  page,
}) => {
  await page.goto('./?path=/story/' + encodeURIComponent(phoneId));
  const outer = page.frameLocator('#storybook-preview-iframe');
  const phone = outer.frameLocator('iframe[title="iPhone 16の写真アプリ"]');
  await phone
    .getByRole('button', { name: '湖畔の朝を開く', exact: true })
    .click();
  await expect(
    phone.getByRole('heading', { name: '湖畔の朝', exact: true }),
  ).toBeVisible();
  await expect(outer.getByRole('status')).toHaveCount(0);
});
