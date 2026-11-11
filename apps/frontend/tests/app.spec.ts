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
    .getByRole('button', { name: 'アルバムを編集', exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: 'テストの思い出', exact: true })
    .check();
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
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

test.describe('iPhone 16', () => {
  test.use({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  test('下部タブ、写真詳細、削除・復元を操作できる', async ({ page }) => {
    await page.goto(story());
    const nav = page.getByRole('navigation', { name: 'メインナビゲーション' });
    await nav.getByRole('link', { name: 'お気に入り', exact: true }).tap();
    await expect(
      page.getByRole('heading', { name: 'お気に入り', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: '湖畔の朝を開く', exact: true })
      .tap();
    await page.getByRole('button', { name: '写真を削除', exact: true }).tap();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(
      bounds && bounds.x >= 0 && bounds.x + bounds.width <= 393,
    ).toBeTruthy();
    await dialog
      .getByRole('button', { name: 'ゴミ箱に移動', exact: true })
      .tap();
    await page.getByRole('button', { name: 'メニュー', exact: true }).tap();
    await page.getByRole('link', { name: 'ゴミ箱', exact: true }).tap();
    await page
      .getByRole('button', { name: '湖畔の朝を開く', exact: true })
      .tap();
    await page.getByRole('button', { name: '復元', exact: true }).tap();
    await expect(
      page.getByRole('heading', { name: 'ゴミ箱は空です' }),
    ).toBeVisible();
    await nav.getByRole('link', { name: 'アルバム', exact: true }).tap();
    await page
      .getByRole('button', { name: 'アルバムを作成', exact: true })
      .tap();
    await page
      .getByRole('textbox', { name: 'アルバム名' })
      .fill('iPhoneの思い出');
    await page.getByRole('button', { name: '作成する', exact: true }).tap();
    await expect(
      page.getByRole('heading', { name: 'iPhoneの思い出', exact: true }),
    ).toBeVisible();
    await nav.getByRole('link', { name: 'フォト', exact: true }).tap();
    await page.getByRole('button', { name: '写真をアップロード' }).tap();
    await page
      .locator('input[type=file]')
      .setInputFiles('public/photos/01.jpg');
    await expect(
      page.getByRole('button', { name: '01.jpgを開く', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const targetSizes = await nav
      .getByRole('link')
      .evaluateAll((elements) =>
        elements.every((el) => el.getBoundingClientRect().height >= 44),
      );
    expect(targetSizes).toBe(true);
  });

  test('検索入力と最後の写真が固定タブに隠れない', async ({ page }) => {
    await page.goto(story());
    await page
      .getByRole('textbox', { name: '写真を検索' })
      .fill('何気ない一日');
    const photo = page.getByRole('button', {
      name: '何気ない一日を開く',
      exact: true,
    });
    await photo.scrollIntoViewIfNeeded();
    await expect(photo).toBeVisible();
    const photoBounds = await photo.boundingBox();
    const navBounds = await page
      .getByRole('navigation', { name: 'メインナビゲーション' })
      .boundingBox();
    expect(
      photoBounds &&
        navBounds &&
        photoBounds.y + photoBounds.height <= navBounds.y,
    ).toBeTruthy();
    await photo.tap();
    await expect(
      page.getByRole('heading', { name: '何気ない一日', exact: true }),
    ).toBeVisible();
  });
});

test('PC上のiPhone 16専用Storyも実幅393×852でアプリを操作できる', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=' +
      encodeURIComponent('スマートフォン-iphone-16--playground') +
      '&viewMode=story',
  );
  const frame = page.frameLocator('iframe[title="iPhone 16の写真アプリ"]');
  await frame
    .getByRole('button', { name: '湖畔の朝を開く', exact: true })
    .click();
  await expect(
    frame.getByRole('heading', { name: '湖畔の朝', exact: true }),
  ).toBeVisible();
  expect(
    await frame.locator('html').evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    })),
  ).toEqual({ width: 393, height: 852 });
});

for (const width of [1280, 393]) {
  test(`独立したアルバム編集と大量アルバム ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    const url = (id: string) =>
      '/iframe.html?id=' +
      encodeURIComponent('issue-21-複数アルバム--' + id) +
      '&viewMode=story';
    async function open(id: string) {
      await page.goto(url(id));
      await page.getByRole('button', { name: '写真の情報' }).click();
      await page
        .getByRole('button', { name: 'アルバムを編集', exact: true })
        .click();
    }
    await open('multiple');
    const first = page.getByRole('checkbox', {
      name: '秋の小旅行',
      exact: true,
    });
    await first.focus();
    await first.press('Space');
    await expect(
      page.getByText('0件追加・1件解除', { exact: true }),
    ).toBeVisible();
    await page.getByRole('searchbox', { name: 'アルバムを検索' }).fill('空');
    await page
      .getByRole('checkbox', { name: '空のアルバム', exact: true })
      .check();
    await page.getByRole('searchbox').fill('');
    await expect(first).not.toBeChecked();
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await expect(page.getByText('未保存の変更を破棄しますか？')).toBeVisible();
    await page.getByRole('button', { name: '編集を続ける' }).click();
    await page.getByRole('button', { name: '変更を保存' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page
      .getByRole('button', { name: 'アルバムを編集', exact: true })
      .click();
    await expect(first).not.toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: '海のある休日', exact: true }),
    ).toBeChecked();
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await open('saving');
    await first.click();
    await page.getByRole('button', { name: '変更を保存' }).click();
    await expect(
      page.getByText('所属を保存しています', { exact: true }),
    ).toBeVisible();
    await expect(first).toBeDisabled();
    await open('error');
    await first.click();
    await page.getByRole('button', { name: '変更を保存' }).click();
    await expect(page.getByRole('alert')).toContainText(
      '1件を保存・確認できませんでした',
    );
    await expect(first).not.toBeChecked();
    await open('partial-failure');
    await first.click();
    await page
      .getByRole('checkbox', { name: '空のアルバム', exact: true })
      .check();
    await page.getByRole('button', { name: '変更を保存' }).click();
    await expect(page.getByRole('alert')).toContainText('1件保存済み。1件');
    await expect(
      page.getByText('0件追加・1件解除', { exact: true }),
    ).toBeVisible();
    await open('no-albums');
    await expect(
      page.getByText('アルバムを作成すると追加できます。'),
    ).toBeVisible();
    await open('trash');
    await first.click();
    await page.getByRole('button', { name: '変更を保存' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await open('many-albums');
    const dialog = page.getByRole('dialog');
    const box = await dialog.boundingBox();
    expect(box && box.y >= 0 && box.y + box.height <= 853).toBeTruthy();
    if (width === 393) expect(box?.height).toBe(852);
    const list = page.getByRole('group', { name: '所属アルバム' });
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
      true,
    );
    await page.getByRole('searchbox').fill('とても長い');
    await expect(page.getByRole('checkbox')).toHaveCount(1);
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.getByRole('searchbox').fill('');
    await page.getByRole('button', { name: '所属中', exact: true }).click();
    await expect(page.getByRole('checkbox')).toHaveCount(8);
    await page.getByRole('checkbox').first().click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('未保存の変更を破棄しますか？')).toBeVisible();
    await page.getByRole('button', { name: '変更を破棄' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: '湖畔の朝', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('ほか5件', { exact: true })).toBeVisible();
  });
}
