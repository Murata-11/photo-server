import { test, expect, type Page } from '@playwright/test';
const key = 'hiyori.appearance';
async function openSettings(page: Page) {
  const menu = page.getByRole('button', { name: 'アカウントメニュー' });
  if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click();
}

test('実アプリで自動追従・手動優先・再訪問保持・ダイアログ配色を確認', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const shell = page.locator('.app-shell');
  await expect(shell).toHaveAttribute('data-appearance', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(shell).toHaveAttribute('data-appearance', 'light');
  await openSettings(page);
  await page.getByRole('radio', { name: 'ダーク', exact: true }).check();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(shell).toHaveAttribute('data-appearance', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    '#111113',
  );
  await page.reload();
  await openSettings(page);
  await expect(
    page.getByRole('radio', { name: 'ダーク', exact: true }),
  ).toBeChecked();
  await page.getByRole('radio', { name: 'システムに合わせる' }).check();
  await expect(shell).toHaveAttribute('data-appearance', 'light');
  await page.getByRole('button', { name: 'アカウントメニュー' }).click();
  await page.getByRole('button', { name: '写真をアップロード' }).click();
  await expect(page.getByRole('dialog')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );
  await expect(page.getByRole('dialog')).toHaveCSS('color-scheme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    '#f8fafd',
  );
});

test('同一ブラウザの別タブへの変更・削除・clearを反映する', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  await openSettings(page);
  await page.getByRole('radio', { name: 'ライト', exact: true }).check();
  await expect(other.locator('.app-shell')).toHaveAttribute(
    'data-appearance',
    'light',
  );
  await openSettings(other);
  await other.getByRole('radio', { name: 'ダーク', exact: true }).check();
  await expect(
    page.getByRole('radio', { name: 'ダーク', exact: true }),
  ).toBeChecked();
  await other.evaluate((name) => localStorage.removeItem(name), key);
  await expect(
    page.getByRole('radio', { name: 'システムに合わせる' }),
  ).toBeChecked();
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-appearance',
    'dark',
  );
  await other.getByRole('radio', { name: 'ライト', exact: true }).check();
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-appearance',
    'light',
  );
  await other.evaluate(() => localStorage.clear());
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-appearance',
    'dark',
  );
  await other.close();
});

for (const failure of ['read', 'write', 'invalid', 'media'] as const) {
  test(`保存・判定の例外でも操作できる：${failure}`, async ({ page }) => {
    await page.addInitScript((mode) => {
      if (mode === 'read')
        Object.defineProperty(window, 'localStorage', {
          get() {
            throw new Error('Denied');
          },
        });
      if (mode === 'write')
        Storage.prototype.setItem = () => {
          throw new Error('Quota');
        };
      if (mode === 'invalid')
        localStorage.setItem('hiyori.appearance', 'invalid-value');
      if (mode === 'media')
        Object.defineProperty(window, 'matchMedia', { value: undefined });
    }, failure);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('.app-shell')).toHaveAttribute(
      'data-appearance',
      failure === 'media' ? 'light' : 'dark',
    );
    await openSettings(page);
    await expect(
      page.getByRole('radio', { name: 'システムに合わせる' }),
    ).toBeChecked();
    await page.getByRole('radio', { name: 'ライト', exact: true }).check();
    await expect(page.locator('.app-shell')).toHaveAttribute(
      'data-appearance',
      'light',
    );
    if (failure === 'read' || failure === 'write')
      await expect(page.getByRole('alert')).toContainText(
        '設定を保存できません',
      );
    else
      expect(
        await page.evaluate((name) => localStorage.getItem(name), key),
      ).toBe('light');
  });
}

test('Reactの読み込み前に保存された配色・背景・ブラウザ色を適用する', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('hiyori.appearance', 'dark'),
  );
  // The synchronous head script must work even while application modules cannot load.
  await page.route('**/*.js', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(17, 17, 19)',
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    '#111113',
  );
  await expect(page.locator('.app-shell')).toHaveCount(0);
});
