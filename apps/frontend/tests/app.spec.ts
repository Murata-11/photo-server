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
    .getByRole('button', { name: 'アルバムに追加・解除', exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: 'テストの思い出', exact: true })
    .check();
  await expect(
    page.getByRole('checkbox', { name: 'テストの思い出', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'アルバムに追加・解除', exact: true }),
  ).toHaveCount(0);
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
  test(`ツールバーから即時保存と大量アルバム ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    const open = async (id: string) => {
      await page.goto(
        '/iframe.html?id=' +
          encodeURIComponent('issue-21-複数アルバム--' + id) +
          '&viewMode=story',
      );
      await page
        .getByRole('button', { name: 'アルバムに追加・解除', exact: true })
        .click();
    };
    await open('multiple');
    const first = page.getByRole('checkbox', {
      name: '秋の小旅行',
      exact: true,
    });
    await first.focus();
    await first.press('Space');
    await expect(first).toBeEnabled();
    await expect(first).not.toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: '海のある休日', exact: true }),
    ).toBeChecked();
    await expect(page.getByRole('button', { name: '変更を保存' })).toHaveCount(
      0,
    );
    await expect(
      page
        .getByRole('region', { name: 'アルバムに追加・解除', exact: true })
        .getByRole('searchbox'),
    ).toHaveCount(0);
    await page
      .getByRole('checkbox', { name: '空のアルバム', exact: true })
      .click();
    await expect(
      page.getByRole('checkbox', { name: '空のアルバム', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await page
      .getByRole('button', { name: 'アルバムに追加・解除', exact: true })
      .click();
    await expect(first).not.toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: '空のアルバム', exact: true }),
    ).toBeChecked();
    await open('saving');
    await first.click();
    await expect(page.getByRole('status')).toContainText('保存中');
    await expect(first).toBeDisabled();
    await expect(
      page.getByRole('checkbox', { name: '海のある休日', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'アルバムに追加・解除', exact: true }),
    ).toHaveCount(0);
    await open('error');
    await first.click();
    await expect(page.getByRole('alert')).toContainText(
      '保存・確認できませんでした',
    );
    await expect(first).toBeChecked();
    await page.getByRole('button', { name: '秋の小旅行を再試行' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await open('partial-failure');
    await first.click();
    await page
      .getByRole('checkbox', { name: '空のアルバム', exact: true })
      .click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(first).toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: '空のアルバム', exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole('checkbox', { name: '空のアルバム', exact: true }),
    ).toBeChecked();
    await open('no-albums');
    await expect(
      page.getByText('アルバムを作成すると追加できます。'),
    ).toBeVisible();
    await open('trash');
    await first.click();
    await expect(first).toBeEnabled();
    await expect(first).not.toBeChecked();
    await open('many-albums');
    const dialog = page.getByRole('region', {
      name: 'アルバムに追加・解除',
      exact: true,
    });
    await page.screenshot({ path: '../../work/album-panel-' + width + '.png' });
    const box = await dialog.boundingBox();
    expect(
      box && box.y >= 0 && box.y + box.height <= 853 && box.height < 600,
    ).toBeTruthy();

    expect(
      await page
        .getByRole('group', { name: '所属アルバム' })
        .evaluate((el) => el.scrollHeight > el.clientHeight),
    ).toBe(true);
    const longName = page.getByRole('checkbox', {
      name: 'とても長いアルバム名'.repeat(8),
      exact: true,
    });
    await longName.scrollIntoViewIfNeeded();
    await expect(longName).toBeVisible();
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await expect(page.getByRole('checkbox')).toHaveCount(121);
    await expect(
      page.getByRole('button', { name: '所属中', exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: '湖畔の朝', exact: true }),
    ).toBeVisible();
  });
}

for (const [width, height] of [
  [320, 568],
  [375, 667],
  [393, 852],
  [852, 393],
]) {
  test(`タッチ端末でアルバム一覧を最後まで操作 ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    for (const story of ['many-albums', 'trash']) {
      await page.goto(
        'http://127.0.0.1:6006/iframe.html?id=' +
          encodeURIComponent('issue-21-複数アルバム--' + story) +
          '&viewMode=story',
      );
      const trigger = page.getByRole('button', {
        name: 'アルバムに追加・解除',
        exact: true,
      });
      await expect(trigger).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const toolbar = await page.locator('.detail-actions').boundingBox();
      expect(
        toolbar && toolbar.x >= 0 && toolbar.x + toolbar.width <= width,
      ).toBeTruthy();
      await trigger.tap();
      const panel = page.getByRole('region', {
          name: 'アルバムに追加・解除',
          exact: true,
        }),
        list = page.getByRole('group', { name: '所属アルバム' });
      await expect(panel.getByRole('searchbox')).toHaveCount(0);
      const bounds = await panel.boundingBox();
      expect(
        bounds &&
          bounds.x >= 0 &&
          bounds.y >= 0 &&
          bounds.x + bounds.width <= width &&
          bounds.y + bounds.height <= height + 1,
      ).toBeTruthy();
      expect(await list.evaluate((el) => el.clientHeight)).toBeGreaterThan(96);
      const last = panel.getByRole('checkbox').last();
      await last.scrollIntoViewIfNeeded();
      await last.tap();
      await expect(last).toBeEnabled();
      const row = await last.boundingBox();
      expect(row && row.y >= 0 && row.y + row.height <= height).toBeTruthy();
      const heading = panel.getByRole('heading', {
        name: 'アルバムに追加・解除',
        exact: true,
      });
      const headingBounds = await heading.boundingBox();
      expect(
        headingBounds &&
          bounds &&
          headingBounds.y >= bounds.y &&
          headingBounds.y + headingBounds.height <= bounds.y + bounds.height,
      ).toBeTruthy();
      expect(await panel.evaluate((el) => el.scrollTop)).toBe(0);
      const close = page.getByRole('button', { name: '閉じる', exact: true });
      const closeBounds = await close.boundingBox();
      expect(
        closeBounds && closeBounds.width >= 44 && closeBounds.height >= 44,
      ).toBeTruthy();
      await page.screenshot({
        path: '../../work/album-fixed-' + width + '-' + story + '.png',
      });
      await close.tap();
      await expect(panel).toHaveCount(0);
    }
    await context.close();
  });
}

test('iPhoneプレビュー内で写真情報と同じ位置に全アルバムを表示', async ({
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
  await frame.getByRole('button', { name: '写真の情報', exact: true }).click();
  const info = await frame.locator('.info-panel').boundingBox();
  await frame
    .getByRole('button', { name: 'アルバムに追加・解除', exact: true })
    .click();
  const panel = frame.getByRole('region', {
    name: 'アルバムに追加・解除',
    exact: true,
  });
  const bounds = await panel.boundingBox();
  expect(
    info &&
      bounds &&
      Math.abs(info.x - bounds.x) <= 1 &&
      Math.abs(info.width - bounds.width) <= 1 &&
      Math.abs(info.y - bounds.y) <= 3,
  ).toBeTruthy();
  await expect(frame.getByRole('dialog')).toHaveCount(0);
  await expect(
    frame.getByRole('button', { name: '所属中', exact: true }),
  ).toHaveCount(0);
  await expect(panel.getByRole('checkbox')).toHaveCount(3);
  await panel
    .getByRole('checkbox', { name: '海のある休日', exact: true })
    .click();
  await expect(
    panel.getByRole('checkbox', { name: '海のある休日', exact: true }),
  ).toBeEnabled();
  await expect(
    panel.getByRole('checkbox', { name: '海のある休日', exact: true }),
  ).toBeChecked();
  await page.screenshot({ path: '../../work/iphone-inline-album-panel.png' });
  await frame.getByRole('button', { name: '写真の情報', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(
    frame.getByRole('heading', { name: '写真の情報', exact: true }),
  ).toBeVisible();
});
