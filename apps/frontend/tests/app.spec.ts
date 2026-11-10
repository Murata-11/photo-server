import { test, expect } from '@playwright/test';
const story = (name = 'playground') =>
  '/iframe.html?id=' +
  encodeURIComponent('アプリ-ひより--' + name) +
  '&viewMode=story';
test('一覧→詳細→お気に入り→削除→ゴミ箱→復元', async ({ page }) => {
  await page.goto(story());
  await page
    .getByRole('button', { name: '湖畔の朝を開く', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '湖畔の朝', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '次の写真', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '山へ続く道', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'お気に入りを切り替え', exact: true })
    .click();
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await page.getByRole('link', { name: 'お気に入り', exact: true }).click();
  await page
    .getByRole('button', { name: '山へ続く道を開く', exact: true })
    .click();
  await page.getByRole('button', { name: '写真を削除', exact: true }).click();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '山へ続く道', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '写真を削除', exact: true }).click();
  await page.getByRole('button', { name: 'ゴミ箱に移動', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '山へ続く道を開く', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'ゴミ箱', exact: true }).click();
  await page
    .getByRole('button', { name: '山へ続く道を開く', exact: true })
    .click();
  await page.getByRole('button', { name: '復元', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'ゴミ箱は空です' }),
  ).toBeVisible();
  await page.getByRole('link', { name: /フォト/ }).click();
  await expect(
    page.getByRole('button', { name: '山へ続く道を開く', exact: true }),
  ).toBeVisible();
});
test('検索、アルバム作成、写真のアルバム変更', async ({ page }) => {
  await page.goto(story());
  const search = page.getByRole('textbox', { name: '写真を検索' });
  await search.fill('存在しない写真');
  await expect(
    page.getByRole('heading', { name: '写真が見つかりませんでした' }),
  ).toBeVisible();
  await search.fill('湖畔');
  await expect(
    page.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '検索をクリア' }).click();
  await page.getByRole('link', { name: 'アルバム', exact: true }).click();
  await page
    .getByRole('button', { name: 'アルバムを作成', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'アルバム名' })
    .fill('テストの思い出');
  await page.getByRole('button', { name: '作成する', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'テストの思い出', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: /フォト/ }).click();
  await page
    .getByRole('button', { name: '湖畔の朝を開く', exact: true })
    .click();
  await page.getByRole('button', { name: '写真の情報' }).click();
  await page
    .getByRole('combobox', { name: 'アルバムに追加' })
    .selectOption('テストの思い出');
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await page.getByRole('link', { name: 'アルバム', exact: true }).click();
  await page.getByRole('button', { name: /テストの思い出/ }).click();
  await expect(
    page.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
  ).toBeVisible();
});
test('アップロードとダウンロード', async ({ page }) => {
  await page.goto(story());
  await page.getByRole('button', { name: '写真を追加', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles('public/photos/01.jpg');
  await page.getByRole('button', { name: '01.jpgを開く', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'ダウンロード' }).click();
  expect((await download).suggestedFilename()).toContain('01.jpg');
});
for (const [id, label] of [
  ['empty', 'まだ写真がありません'],
  ['error', '写真を読み込めませんでした'],
  ['loading', '写真を読み込んでいます'],
])
  test(`状態: ${id}`, async ({ page }) => {
    await page.goto(story(id));
    await expect(
      page.getByRole('heading', { name: label, exact: true }),
    ).toBeVisible();
  });
test('モバイルでメニューと詳細を操作できる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(story());
  await page.getByRole('button', { name: 'メニュー', exact: true }).click();
  await page.getByRole('link', { name: 'お気に入り', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'お気に入り', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '湖畔の朝を開く', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '湖畔の朝', exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
