import { test, expect } from '@playwright/test';
const url = `/iframe.html?id=${encodeURIComponent('スマートフォン-iphone-16--playground')}&viewMode=story&smartphoneCanvas=1`;
for (const width of [1440, 393]) {
  test(`共有の準備・キャンセル・再試行を操作 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async ({ files }: ShareData) => {
          if (!files?.[0]?.size) throw new Error('empty file');
          if (!navigator.userActivation.isActive)
            throw new Error('no user activation');
          throw new DOMException('cancel', 'AbortError');
        },
      });
    });
    await page.goto(url);
    await page
      .getByRole('button', { name: '湖畔の朝を開く', exact: true })
      .click();
    await page.getByRole('button', { name: '写真に保存', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('status')).toContainText('準備ができました');
    await dialog.getByRole('button', { name: '共有画面を開く' }).click();
    await expect(dialog.getByRole('status')).toContainText('キャンセル');
    await dialog.getByRole('button', { name: '共有画面を開く' }).click();
    await expect(dialog.getByRole('status')).toContainText('キャンセル');
    await expect(
      dialog.getByRole('link', { name: 'ダウンロード' }),
    ).toHaveAttribute('download', '湖畔の朝');
    const bounds = await dialog.boundingBox();
    expect(bounds).toBeTruthy();
    expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width).toBe(
      true,
    );
    await page.screenshot({ path: `../../work/save-photo-${width}.png` });
    await dialog.getByRole('button', { name: '閉じる' }).click();
    await expect(dialog).toHaveCount(0);
  });
}
