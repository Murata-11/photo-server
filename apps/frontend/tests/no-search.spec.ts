import { test, expect } from '@playwright/test';

for (const size of [
  { width: 1440, height: 1000 },
  { width: 393, height: 852 },
  { width: 320, height: 568 },
]) {
  test(`検索なしのヘッダーとメニュー ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    for (const name of [
      'photos',
      'albums',
      'favorites',
      'trash',
      'detail',
      'empty',
      'loading',
      'error',
      'upload',
    ]) {
      await page.goto(
        `/iframe.html?id=issue-23-検索バーのない画面--${name}&viewMode=story`,
      );
      const header = page.locator('.topbar');
      await expect(header).toBeVisible();
      await expect(
        page.getByRole('textbox', { name: '写真を検索' }),
      ).toHaveCount(0);
      expect((await header.boundingBox())?.height).toBe(72);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const content = await page.locator('.main-content').boundingBox();
      expect(content?.y).toBeGreaterThanOrEqual(72);
      if (name === 'photos') {
        await expect(
          page.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
        ).toBeVisible();
        await page.screenshot({ path: `../../work/issue23-${size.width}.png` });
        if (size.width <= 760) {
          await page
            .getByRole('button', { name: 'メニュー', exact: true })
            .click();
          const menu = await page.locator('.sidebar').boundingBox();
          expect(menu?.y).toBe(72);
          await page.getByRole('button', { name: 'メニューを閉じる' }).click({
            position: { x: size.width - 8, y: 10 },
          });
          await expect(page.locator('.sidebar')).toBeHidden();
        }
      }
    }
  });
}
