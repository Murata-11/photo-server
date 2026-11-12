import { test, expect } from '@playwright/test';
const story = (name: string) =>
  `/iframe.html?id=issue-44-外観設定--${name}&viewMode=story`;
for (const width of [1440, 393, 320]) {
  test(`外観をキーボードで切替・自動へ復帰できる ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.goto(story('system-light'));
    const shell = page.locator('.app-shell');
    await expect(shell).toHaveAttribute('data-appearance', 'light');
    await page.getByRole('button', { name: 'アカウントメニュー' }).click();
    const group = page.getByRole('group', { name: '外観' });
    await expect(
      group.getByRole('radio', { name: 'システムに合わせる' }),
    ).toBeChecked();
    await group.getByRole('radio', { name: 'システムに合わせる' }).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(shell).toHaveAttribute('data-appearance', 'dark');
    await expect(group).toContainText('現在の表示：ダーク');
    await group.getByRole('radio', { name: 'システムに合わせる' }).check();
    await expect(shell).toHaveAttribute('data-appearance', 'light');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `../../work/appearance-menu-${width}.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '写真をアップロード' }).click();
    await expect(page.getByRole('dialog')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    await expect(page.getByRole('dialog')).toHaveCSS('color-scheme', 'light');
  });
}
test('手動設定はシステムより優先し、自動は指定したOS配色を使う', async ({
  page,
}) => {
  for (const [name, expected] of [
    ['system-dark', 'dark'],
    ['manual-light', 'light'],
    ['manual-dark', 'dark'],
  ] as const) {
    await page.goto(story(name));
    await expect(page.locator('.app-shell')).toHaveAttribute(
      'data-appearance',
      expected,
    );
  }
  await page.goto(story('storage-unavailable'));
  await page.getByRole('button', { name: 'アカウントメニュー' }).click();
  await expect(page.getByRole('alert')).toContainText('設定を保存できません');
  await page.getByRole('radio', { name: 'ダーク', exact: true }).check();
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-appearance',
    'dark',
  );
});
test('ライトの詳細も鑑賞背景は暗色で、通常アプリのStoryはダークを維持する', async ({
  page,
}) => {
  await page.goto(story('detail'));
  await expect(page.locator('.detail-image')).toBeVisible();
  await expect(page.locator('.detail-stage')).toHaveCSS(
    'background-color',
    'rgb(8, 8, 9)',
  );
  await page.screenshot({ path: '../../work/appearance-detail.png' });
  await page.goto(
    '/iframe.html?id=デザイン提案-モバイルダーク--photos&viewMode=story',
  );
  await expect(page.locator('.app-shell')).toHaveCSS(
    'background-color',
    'rgb(17, 17, 19)',
  );
  await page.getByRole('button', { name: 'アカウントメニュー' }).click();
  await expect(page.getByRole('group', { name: '外観' })).toHaveCount(0);
});
test('表示中のOS変更を自動だけに反映し、自動復帰は最新のOS設定を使う', async ({
  page,
}) => {
  await page.goto(story('system-change'));
  const shell = page.locator('.app-shell');
  await expect(shell).toHaveAttribute('data-appearance', 'light');
  await page
    .getByRole('button', { name: 'レビュー用：システムをダークへ変更' })
    .click();
  await expect(shell).toHaveAttribute('data-appearance', 'dark');
  await page.getByRole('button', { name: 'アカウントメニュー' }).click();
  await page.getByRole('radio', { name: 'ライト', exact: true }).check();
  await page
    .getByRole('button', { name: 'レビュー用：システムをライトへ変更' })
    .click();
  await page
    .getByRole('button', { name: 'レビュー用：システムをダークへ変更' })
    .click();
  await expect(shell).toHaveAttribute('data-appearance', 'light');
  await page.getByRole('button', { name: 'アカウントメニュー' }).click();
  await page.getByRole('radio', { name: 'システムに合わせる' }).check();
  await expect(shell).toHaveAttribute('data-appearance', 'dark');
});
test('ライトの各画面・状態が表示され、狭い画面でも横にはみ出さない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const name of [
    'albums',
    'album',
    'favorites',
    'trash',
    'empty',
    'loading',
    'error',
    'upload',
  ]) {
    await page.goto(story(name));
    await expect(page.locator('.app-shell')).toHaveAttribute(
      'data-appearance',
      'light',
    );
    await expect(page.locator('.app-shell')).toBeVisible();
    if (name === 'loading') {
      await expect(
        page.getByRole('heading', { name: '写真を読み込んでいます' }),
      ).toBeVisible();
    } else if (name === 'error') {
      await expect(
        page.getByRole('heading', { name: '写真を読み込めませんでした' }),
      ).toBeVisible();
    } else if (name === 'empty') {
      await expect(
        page.getByRole('heading', { name: 'まだ写真がありません' }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole('heading', { name: '写真を読み込んでいます' }),
      ).toHaveCount(0);
      await expect(
        page
          .locator('.album-card, .photo-tile, .empty-state, [role=dialog]')
          .first(),
      ).toBeVisible();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (name === 'upload') await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: `../../work/appearance-${name}-320.png` });
  }
});
