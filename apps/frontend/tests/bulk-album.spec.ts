import { test, expect } from '@playwright/test';
const story = (name: string) =>
  '/iframe.html?id=' +
  encodeURIComponent('issue-22-写真の一括アルバム追加--' + name) +
  '&viewMode=story';
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 393, height: 852 },
  { width: 320, height: 852 },
]) {
  test(`一括追加・キャンセル ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(story('normal'));
    await page
      .getByRole('button', { name: '湖畔の朝を選択', exact: true })
      .click();
    await page
      .getByRole('button', { name: '山へ続く道を選択', exact: true })
      .click();
    const actions = await page
      .locator('.selection-actions button')
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return {
            y: box.y,
            width: box.width,
            client: button.clientWidth,
            scroll: button.scrollWidth,
          };
        }),
      );
    expect(actions).toHaveLength(3);
    expect(actions[0]?.y).toBe(actions[1]?.y);
    if (viewport.width <= 760)
      expect(actions[2]?.y).toBeGreaterThan(actions[1]?.y ?? 0);
    for (const action of actions)
      expect(action.scroll).toBeLessThanOrEqual(action.client);
    if (viewport.width <= 760)
      expect(actions[0]?.width).toBe(actions[1]?.width);
    await page
      .getByRole('button', { name: 'アルバムに追加', exact: true })
      .click();
    await page.getByRole('combobox').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await expect(page.getByText('2枚を選択中')).toBeVisible();
    await page
      .getByRole('button', { name: 'アルバムに追加', exact: true })
      .click();
    await page.getByRole('combobox').selectOption({ index: 1 });
    await page.getByRole('button', { name: '追加', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('2枚を選択中')).toHaveCount(0);
    await expect(
      page.getByText('アルバムに追加しました', { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  });
}
for (const name of [
  'saving',
  'error',
  'unknown',
  'refresh-error',
  'no-albums',
]) {
  test(`一括追加の状態 ${name}`, async ({ page }) => {
    await page.goto(story(name));
    await page
      .getByRole('button', { name: '湖畔の朝を選択', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'アルバムに追加', exact: true })
      .click();
    if (name === 'no-albums') {
      await expect(
        page.getByText('アルバムがありません。', { exact: false }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: '追加', exact: true }),
      ).toBeDisabled();
      return;
    }
    await page.getByRole('combobox').selectOption({ index: 1 });
    await page.getByRole('button', { name: '追加', exact: true }).click();
    if (name === 'saving') {
      await expect(page.getByRole('status')).toContainText('追加しています');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'キャンセル', exact: true }),
      ).toBeDisabled();
    } else {
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(
        page.getByRole('button', {
          name: name === 'refresh-error' ? '再取得' : '再試行',
          exact: true,
        }),
      ).toBeEnabled();
      if (name === 'refresh-error')
        await expect(page.getByRole('alert')).toContainText('追加は完了');
      else
        await expect(
          page.getByText('1枚の写真を既存', { exact: false }),
        ).toBeVisible();
    }
  });
}
