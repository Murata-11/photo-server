import { test, expect } from '@playwright/test';
const url = `/iframe.html?id=${encodeURIComponent('スマートフォン-iphone-16--playground')}&viewMode=story&smartphoneCanvas=1`;
for (const width of [1440, 393]) {
  test(`元画像のプレビューを別タブで開きダウンロードも選べる ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.goto(url);
    await page
      .getByRole('button', { name: '湖畔の朝を開く', exact: true })
      .click();
    await expect(page.locator('.detail-image')).toHaveAttribute(
      'src',
      /photos\/01.jpg\?disposition=inline$/,
    );
    expect(
      await page.locator('.detail-image').evaluate((element) => {
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(event);
        return event.defaultPrevented;
      }),
    ).toBe(false);
    await page.getByRole('button', { name: '写真に保存', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const preview = dialog.getByRole('link', { name: '元画像をプレビュー' });
    await expect(preview).toHaveAttribute(
      'href',
      /photos\/01.jpg\?disposition=inline$/,
    );
    const opened = page.waitForEvent('popup');
    await preview.click();
    const image = await opened;
    await image.waitForLoadState();
    await expect(image.locator('img')).toBeVisible();
    expect(
      await image.locator('img').evaluate((element) => element.naturalWidth),
    ).toBeGreaterThan(0);
    await image.close();
    await expect(
      dialog.getByRole('link', { name: 'ダウンロード' }),
    ).toHaveAttribute('download', '湖畔の朝');
    const bounds = await dialog.boundingBox();
    expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width).toBe(
      true,
    );
    await page.screenshot({
      path: `../../work/save-photo-preview-${width}.png`,
    });
    await dialog.getByRole('button', { name: '閉じる' }).click();
    await expect(dialog).toHaveCount(0);
  });
}
