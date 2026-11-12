import { test, expect } from '@playwright/test';
const id = 'pc-デスクトップ--playground';
for (const width of [1600, 393]) {
  test(`PC画面モックは1440×960を維持して操作できる ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto(`/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`);
    const frame = page.frameLocator('iframe[title="PCの写真アプリ"]');
    await expect(frame.locator('.app-shell')).toBeVisible({ timeout: 20000 });
    expect(
      await frame
        .locator('html')
        .evaluate(() => ({ width: innerWidth, height: innerHeight })),
    ).toEqual({ width: 1440, height: 960 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await frame
      .getByRole('button', { name: '湖畔の朝を開く', exact: true })
      .click();
    await expect(frame.locator('.detail-image')).toHaveAttribute(
      'alt',
      '湖畔の朝',
    );
    await frame
      .getByRole('button', { name: '写真に保存', exact: true })
      .click();
    await expect(
      frame.getByRole('link', { name: '元画像をプレビュー' }),
    ).toBeVisible();
    await frame.getByRole('button', { name: '閉じる', exact: true }).click();
    await frame.getByRole('button', { name: '戻る', exact: true }).click();
    await page.screenshot({
      path: `../../work/desktop-preview-${width}.png`,
      fullPage: true,
    });
  });
}
