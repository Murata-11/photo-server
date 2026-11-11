import { test, expect, type Page } from '@playwright/test';
const story = (name = 'normal') =>
  '/iframe.html?id=' +
  encodeURIComponent('issue-26-写真の一括ゴミ箱移動--' + name) +
  '&viewMode=story';
async function select(page: Page) {
  for (const name of ['湖畔の朝', '山へ続く道'])
    await page
      .getByRole('button', { name: name + 'を選択', exact: true })
      .click();
  const trigger = page.getByRole('button', {
    name: 'ゴミ箱に移動',
    exact: true,
  });
  await expect(trigger).toHaveText('');
  const bar = await page.locator('.selection-bar').boundingBox();
  const icon = await trigger.boundingBox();
  expect(
    bar &&
      icon &&
      icon.x + icon.width <= bar.x + bar.width &&
      icon.x > bar.x + bar.width / 2 &&
      icon.y - bar.y <= 8 &&
      icon.width >= 44 &&
      icon.height >= 44,
  ).toBeTruthy();
  await page.screenshot({
    path: `../../work/issue26-selection-${page.viewportSize()?.width}.png`,
  });
  await trigger.click();
}
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 393, height: 852 },
  { width: 320, height: 568 },
]) {
  test(`一括移動・キャンセル・復元 ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(story());
    await select(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading')).toHaveText(
      '2枚をゴミ箱に移動しますか？',
    );
    await expect(dialog.getByText(/共有ライブラリ全体/)).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'キャンセル', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByText('2枚を選択中')).toBeVisible();
    await page
      .getByRole('button', { name: 'ゴミ箱に移動', exact: true })
      .click();
    await page.screenshot({
      path: `../../work/issue26-confirm-${viewport.width}.png`,
    });
    const box = await dialog.boundingBox();
    expect(
      box &&
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width &&
        box.y + box.height <= viewport.height,
    ).toBeTruthy();
    await dialog
      .getByRole('button', { name: 'ゴミ箱に移動', exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('2枚を選択中')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '青い時間を開く', exact: true }),
    ).toBeVisible();
    if (viewport.width <= 760)
      await page.getByRole('button', { name: 'メニュー', exact: true }).click();
    await page.getByRole('link', { name: 'ゴミ箱', exact: true }).click();
    await page
      .getByRole('button', { name: '湖畔の朝を選択', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'ゴミ箱に移動', exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: '湖畔の朝を開く', exact: true })
      .click();
    await page.getByRole('button', { name: '復元', exact: true }).click();
    await page
      .getByRole('link', { name: /^フォト/ })
      .last()
      .click();
    await expect(
      page.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
for (const mode of [
  'saving',
  'error',
  'unknown',
  'refresh-error',
  'not-found',
]) {
  test(`一括移動の状態 ${mode}`, async ({ page }) => {
    await page.goto(story(mode));
    let puts = 0;
    page.on('request', (request) => {
      if (
        request.method() === 'PUT' &&
        request.url().endsWith('/api/photos/trash')
      )
        puts++;
    });
    await select(page);
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('button', { name: 'ゴミ箱に移動', exact: true })
      .click();
    if (mode === 'saving') {
      await expect(dialog.getByRole('status')).toHaveText(
        'ゴミ箱に移動しています…',
      );
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'キャンセル', exact: true }),
      ).toBeDisabled();
      await expect(
        dialog.getByRole('button', { name: '閉じる', exact: true }),
      ).toBeDisabled();
      expect(puts).toBe(1);
    } else {
      await expect(dialog.getByRole('alert')).toBeVisible();
      if (mode === 'refresh-error') {
        await expect(dialog.getByRole('alert')).toContainText('移動は完了');
        await dialog
          .getByRole('button', { name: '再取得', exact: true })
          .click();
        await expect(dialog).toHaveCount(0);
        expect(puts).toBe(1);
      } else {
        await expect(page.getByText('2枚を選択中')).toBeVisible();
        if (mode === 'unknown') {
          await expect(dialog.getByRole('alert')).toContainText('結果が不明');
          await dialog
            .getByRole('button', { name: '同じ対象を再試行', exact: true })
            .click();
          await expect(dialog).toHaveCount(0);
          expect(puts).toBe(2);
        }
        if (mode === 'not-found')
          await expect(dialog.getByRole('alert')).toContainText('選び直して');
      }
    }
  });
}
test('アルバム内の説明と101枚上限', async ({ page }) => {
  await page.goto(story('album'));
  await select(page);
  await expect(page.getByText(/所属解除ではありません/)).toBeVisible();
  await page.goto(story('over-limit'));
  await expect(page.getByRole('alert')).toContainText('100枚まで');
  await expect(
    page.getByRole('button', { name: 'ゴミ箱に移動', exact: true }),
  ).toBeDisabled();
});
