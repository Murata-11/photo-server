import { test, expect } from '@playwright/test';
const id = 'スマートフォン-iphone-16--playground';
const url = `/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`;

test('StorybookにはiPhoneプレビュー1件だけが掲載される', async ({
  page,
  request,
}) => {
  const index = await (await request.get('/index.json')).json();
  expect(Object.keys(index.entries)).toEqual([id]);
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`/?path=/story/${encodeURIComponent(id)}`);
  const phone = page
    .frameLocator('#storybook-preview-iframe')
    .frameLocator('iframe[title="iPhone 16の写真アプリ"]');
  await expect(phone.locator('.app-shell')).toBeVisible({ timeout: 20000 });
  await expect(
    phone.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
  ).toBeVisible();
  expect(
    await phone.locator('html').evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    })),
  ).toEqual({ width: 393, height: 852 });
  await expect(
    page.getByRole('region', { name: 'Addon panel', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: '../../work/iphone-only-storybook.png',
    fullPage: true,
  });
});
for (const width of [1440, 393, 320]) {
  test(`iPhone画面内で外観・写真・アルバム・選択・アップロードを操作 ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(url);
    const phone = page.frameLocator('iframe[title="iPhone 16の写真アプリ"]');
    const shell = phone.locator('.app-shell');
    await expect(shell).toHaveAttribute('data-appearance', 'dark');
    await phone.getByRole('button', { name: 'アカウントメニュー' }).click();
    await phone.getByRole('radio', { name: 'ライト', exact: true }).check();
    await expect(shell).toHaveAttribute('data-appearance', 'light');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(shell).toHaveAttribute('data-appearance', 'light');
    await phone.getByRole('radio', { name: 'システムに合わせる' }).check();
    await expect(shell).toHaveAttribute('data-appearance', 'dark');
    await phone.getByRole('button', { name: 'アカウントメニュー' }).click();
    await phone
      .getByRole('button', { name: '湖畔の朝を開く', exact: true })
      .click();
    await expect(phone.locator('.detail-image')).toHaveAttribute(
      'alt',
      '湖畔の朝',
    );
    await phone
      .getByRole('button', { name: 'アルバムに追加・解除', exact: true })
      .click();
    await expect(
      phone.getByRole('group', { name: '所属アルバム' }),
    ).toBeVisible();
    await phone.getByRole('button', { name: '閉じる', exact: true }).click();
    await phone.getByRole('button', { name: '戻る', exact: true }).click();
    await phone
      .getByRole('button', { name: '湖畔の朝を開く', exact: true })
      .press('Shift+Enter');
    await expect(
      phone.getByRole('status', { name: '1枚を選択中' }),
    ).toBeVisible();
    await phone
      .getByRole('button', { name: 'アルバムに追加', exact: true })
      .click();
    await expect(phone.getByRole('dialog')).toBeVisible();
    await phone
      .getByRole('button', { name: 'キャンセル', exact: true })
      .click();
    await phone.getByRole('button', { name: '選択解除', exact: true }).click();
    await phone.getByRole('link', { name: 'アルバム', exact: true }).click();
    await expect(phone.locator('.album-card').first()).toBeVisible();
    await phone.getByRole('button', { name: '写真をアップロード' }).click();
    await expect(phone.getByRole('dialog')).toBeVisible();
    await expect(phone.getByText(/6,000万画素まで/)).toBeVisible();
    expect(
      await phone
        .locator('html')
        .evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
    ).toBe(true);
    await page.screenshot({ path: `../../work/iphone-only-${width}.png` });
  });
}
test('プレビューの読み込み失敗から再読み込みできる', async ({ page }) => {
  let blocked = true;
  await page.route('**/iframe.html?**', async (route) => {
    const target = new URL(route.request().url());
    if (blocked && target.searchParams.has('smartphoneCanvas'))
      await route.abort();
    else await route.continue();
  });
  await page.goto(url);
  await expect(page.getByRole('alert')).toContainText(
    'プレビューを読み込めませんでした',
    { timeout: 20000 },
  );
  blocked = false;
  await page.getByRole('button', { name: '再読み込み', exact: true }).click();
  await expect(
    page
      .frameLocator('iframe[title="iPhone 16の写真アプリ"]')
      .locator('.app-shell'),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
