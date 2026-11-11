import { test, expect } from '@playwright/test';
import { writeFile, truncate } from 'node:fs/promises';
const story = (name: string) =>
  '/iframe.html?id=' +
  encodeURIComponent('issue-20-48mp・heicアップロード--' + name) +
  '&viewMode=story';
const file = {
  name: 'synthetic-48mp.heic',
  mimeType: 'image/heic',
  // UIモック用。実HEIC・48MPデコードの検証ではない。
  buffer: Buffer.from('ui fixture only'),
};
for (const width of [1440, 393]) {
  test(`HEICの選択・保存と画面案内 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 393 ? 852 : 1000 });
    await page.goto(story('normal'));
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/6,000万画素まで/)).toBeVisible();
    expect(
      await page.locator('input[type=file]').getAttribute('accept'),
    ).toContain('image/heic');
    await page.screenshot({ path: `../../work/issue20-upload-${width}.png` });
    await page.locator('input[type=file]').setInputFiles(file);
    await expect(page.getByText('1枚の写真を追加しました')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  });
}
for (const [name, message] of [
  ['pixel-limit', '6,000万画素以下の画像を選んでください'],
  ['corrupt', '画像を読み込めません。破損していない画像を選んでください'],
  ['mismatch', '画像の形式と内容が一致しません'],
  ['multiple', '複数画像・アニメーション・動画には対応していません'],
  ['unsupported', 'JPEG・PNG・WebP・HEICの静止画像を選んでください'],
  ['busy', '画像を処理できませんでした。時間をおいて再試行してください'],
] as const) {
  test(`失敗理由を表示し再試行できる ${name}`, async ({ page }) => {
    await page.goto(story(name));
    await page.locator('input[type=file]').setInputFiles(file);
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /写真を選択する/ }),
    ).toBeEnabled();
    await expect(page.getByText('1枚の写真を追加しました')).toHaveCount(0);
  });
}
test('保存中・容量/形式の拒否・Escapeと通常アプリの互換', async ({
  page,
}, testInfo) => {
  await page.goto(story('saving'));
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(
    page.getByRole('button', { name: /写真を追加しています/ }),
  ).toBeDisabled();
  await page.goto(story('normal'));
  const largePath = testInfo.outputPath('large.heic');
  await writeFile(largePath, '');
  await truncate(largePath, 50 * 1024 * 1024 + 1);
  await page.locator('input[type=file]').setInputFiles(largePath);
  await expect(
    page.getByText('1枚50MB以下の画像を選んでください'),
  ).toBeVisible();
  await page
    .locator('input[type=file]')
    .setInputFiles({ ...file, name: 'bad.gif', mimeType: 'image/gif' });
  await expect(
    page.getByText('JPEG・PNG・WebP・HEICの静止画像を選んでください'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(
    '/iframe.html?id=' +
      encodeURIComponent('アプリ-ひより--playground') +
      '&viewMode=story',
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('input[type=file]')).toHaveAttribute(
    'accept',
    'image/jpeg,image/png,image/webp,image/heic,image/heif',
  );
});
