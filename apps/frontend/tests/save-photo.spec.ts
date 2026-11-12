import { test, expect } from '@playwright/test';
const url = `/iframe.html?id=${encodeURIComponent('スマートフォン-iphone-16--playground')}&viewMode=story&smartphoneCanvas=1`;
for (const width of [1440, 393]) {
  test(`詳細は元画像を表示しダウンロードを直接実行する ${width}`, async ({
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
    const download = page.getByRole('link', { name: 'ダウンロード' });
    await expect(download).toHaveAttribute('href', 'photos/01.jpg');
    await expect(download).toHaveAttribute('download', '湖畔の朝');
    const downloaded = page.waitForEvent('download');
    await download.click();
    const file = await downloaded;
    expect(await file.failure()).toBeNull();
    expect(file.suggestedFilename()).toMatch(/^湖畔の朝/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.detail-image')).toBeVisible();
  });
}
