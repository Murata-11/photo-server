import { test, expect } from '@playwright/test';
const story = (name = 'photos') =>
  '/iframe.html?id=' +
  encodeURIComponent('デザイン提案-モバイルダーク--' + name) +
  '&viewMode=story';
test('ダークUIをスマホで操作し、アルバム・作成・詳細を確認する', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(story());
  await expect(
    page.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveClass(/mobile-dark/);
  await expect(page.locator('#library-menu')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'メニュー', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.main-content > .page-heading')).toHaveCount(0);
  await expect(page.locator('.gallery-toolbar')).toHaveCount(0);
  await expect(page.locator('.date-heading')).toHaveCount(0);
  await expect(page.locator('.photo-grid')).toHaveCount(1);
  await expect(page.locator('.photo-grid > .photo-tile')).toHaveCount(18);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator('.photo-grid')
      .first()
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
      ),
  ).toBe(3);
  await page.screenshot({
    path: '../../work/mobile-dark-photos.png',
    fullPage: false,
    style: '[data-sonner-toaster] { visibility: hidden; }',
  });
  const nav = page.getByRole('navigation', { name: 'メインナビゲーション' });
  await nav.getByRole('link', { name: 'アルバム', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'アルバム', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: '../../work/mobile-dark-albums.png',
    fullPage: false,
    style: '[data-sonner-toaster] { visibility: hidden; }',
  });
  await page.getByRole('button', { name: /秋の小旅行/ }).click();
  await expect(
    page.getByRole('heading', { name: '秋の小旅行', exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.date-heading, .gallery-toolbar, .heading-tools'),
  ).toHaveCount(0);
  await expect(page.locator('.photo-grid')).toHaveCount(1);
  await expect(page.locator('.photo-grid > .photo-tile')).toHaveCount(8);
  await page.screenshot({ path: '../../work/mobile-dark-album-gallery.png' });
  await nav.getByRole('button', { name: '作成', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'アルバム名', exact: true })
    .fill('ふたりの冬');
  await page.getByRole('button', { name: '作成する', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'ふたりの冬', exact: true }),
  ).toBeVisible();
  await nav.getByRole('link', { name: 'フォト', exact: true }).click();
  await page
    .getByRole('button', { name: '湖畔の朝を開く', exact: true })
    .click();
  await expect(page.locator('.detail-image[alt="湖畔の朝"]')).toBeVisible();
  await page.screenshot({
    path: '../../work/mobile-dark-detail.png',
    fullPage: false,
    style: '[data-sonner-toaster] { visibility: hidden; }',
  });
  await page
    .getByRole('button', { name: '写真をアップロード', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
});
test('ダークUIの空・失敗・読み込み状態とPC幅を表示する', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  for (const [name, heading] of [
    ['empty', 'まだ写真がありません'],
    ['error', '写真を読み込めませんでした'],
    ['loading', '写真を読み込んでいます'],
  ]) {
    await page.goto(story(name));
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(story());
  await expect(page.locator('#library-menu')).toHaveCount(0);
  await expect(page.locator('.mobile-bottom-nav')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '写真をアップロード', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('専用iPhoneプレビューと320px幅でナビと最後の写真を確認する', async ({
  page,
}) => {
  await page.goto(story('i-phone-16'));
  const phone = page.frameLocator('iframe[title="iPhone 16の写真アプリ"]');
  await expect(phone.locator('.mobile-dark')).toBeVisible();
  await expect(
    phone.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(story());
  await expect(
    page.getByRole('button', { name: '湖畔の朝を開く', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const last = page.locator('.photo-tile').last();
  await last.scrollIntoViewIfNeeded();
  const header = await page.locator('.topbar').boundingBox();
  expect(header && header.y + header.height <= 0).toBeTruthy();
  await expect(page.locator('.mobile-bottom-nav')).toBeVisible();
  const photo = await last.boundingBox();
  const nav = await page.locator('.mobile-bottom-nav').boundingBox();
  expect(photo && nav && photo.y + photo.height <= nav.y).toBeTruthy();
});

test('連続グリッドをスクロールするとアップロード期間が切り替わる', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-12T12:00:00Z'));
  await page.setViewportSize({ width: 393, height: 300 });
  await page.goto(story());
  await expect(page.locator('.photo-tile')).toHaveCount(18);
  const period = page.getByLabel('アップロード期間（UTC）');
  await expect(period).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 100));
  await expect(period).toHaveText('11月2日〜8日');
  await expect(period).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(period).toHaveText('10月19日〜25日');
  await page.screenshot({
    path: '../../work/mobile-dark-period.png',
    style: '[data-sonner-toaster] { visibility: hidden; }',
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(period).toBeHidden();
});

test.describe('長押し選択', () => {
  test.use({ hasTouch: true });
  test('丸を隠し、長押し後の追加選択・解除・アルバム保存を操作できる', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(story());
    const first = page.getByRole('button', {
      name: '湖畔の朝を開く',
      exact: true,
    });
    await expect(first).toBeVisible();
    await expect(page.locator('.photo-select')).toHaveCount(0);
    await first.scrollIntoViewIfNeeded();
    const originalImages = await page
      .locator('.photo-open img')
      .elementHandles();
    const reads: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'GET' &&
        new URL(request.url()).pathname.endsWith('/api/photos')
      )
        reads.push(request.url());
    });
    const bounds = await first.boundingBox();
    if (!bounds) throw new Error('写真が表示されていません');
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
      ],
    });
    await expect(
      page.getByRole('status', { name: '1枚を選択中' }),
    ).toBeVisible();
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect(
      page.getByRole('status', { name: '1枚を選択中' }),
    ).toBeVisible();
    await expect(page.locator('.photo-select')).toHaveCount(18);
    await expect(
      page.getByRole('navigation', { name: 'メインナビゲーション' }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: '山へ続く道を選択', exact: true })
      .tap();
    await expect(
      page.getByRole('status', { name: '2枚を選択中' }),
    ).toBeVisible();
    expect(
      await Promise.all(
        originalImages.map((image) =>
          image.evaluate((node) => node.isConnected),
        ),
      ),
    ).toEqual(originalImages.map(() => true));
    expect(reads).toEqual([]);
    await page.mouse.move(10, 20);
    await page.screenshot({ path: '../../work/mobile-dark-selection.png' });
    const panel = page.getByRole('region', { name: '選択した写真の操作' });
    await panel
      .getByRole('button', { name: 'アルバムに追加', exact: true })
      .tap();
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await expect(
      page.getByRole('status', { name: '2枚を選択中' }),
    ).toBeVisible();
    await panel
      .getByRole('button', { name: 'アルバムに追加', exact: true })
      .tap();
    await page
      .getByRole('combobox', { name: '追加先' })
      .selectOption('海のある休日');
    await page.getByRole('button', { name: '追加', exact: true }).click();
    await expect(page.locator('.selection-panel')).toHaveCount(0);
    await expect(page.locator('.photo-select')).toHaveCount(0);
    await first.focus();
    await page.keyboard.press('Shift+Enter');
    await page
      .getByRole('button', { name: '湖畔の朝を選択', exact: true })
      .click();
    await expect(
      page.getByRole('status', { name: '0枚を選択中' }),
    ).toBeVisible();
    await expect(
      panel.getByRole('button', { name: 'アルバムに追加', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: '選択解除', exact: true }).click();
    await expect(page.locator('.photo-select')).toHaveCount(0);
  });
  test('選択状態のStoryを直接レビューできる', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(story('selection'));
    await expect(
      page.getByRole('status', { name: '1枚を選択中' }),
    ).toBeVisible();
    await expect(page.locator('.photo-select')).toHaveCount(18);
    await expect(
      page.getByRole('region', { name: '選択した写真の操作' }),
    ).toBeVisible();
  });
  test('指の移動・キャンセルでは長押し選択を開始しない', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(story());
    const first = page.getByRole('button', {
      name: '湖畔の朝を開く',
      exact: true,
    });
    await first.dispatchEvent('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerType: 'touch',
      clientX: 50,
      clientY: 130,
    });
    await first.dispatchEvent('pointermove', {
      pointerType: 'touch',
      clientX: 50,
      clientY: 180,
    });
    await first.dispatchEvent('pointercancel', { pointerType: 'touch' });
    await page.waitForTimeout(600);
    await expect(page.locator('.selection-panel')).toHaveCount(0);
    await expect(page.locator('.photo-select')).toHaveCount(0);
  });
});

test.describe('写真詳細のスワイプ', () => {
  test.use({ hasTouch: true });
  test('写真詳細は上下固定でスワイプし、タップで矢印を切り替えられる', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(story('detail'));
    const photo = page.locator('.detail-image');
    await expect(photo).toHaveAttribute('alt', '湖畔の朝');
    await expect(
      page.locator('.previous-photo, .next-photo, .detail-caption'),
    ).toHaveCount(0);
    const touch = await page.context().newCDPSession(page);
    async function swipe(direction: 'left' | 'right' | 'short' | 'vertical') {
      const stage = page.locator('.swipe-photo-stage');
      await stage.scrollIntoViewIfNeeded();
      const bounds = await stage.boundingBox();
      if (!bounds) throw new Error('写真が表示されていません');
      const x = bounds.x + bounds.width / 2,
        y = bounds.y + bounds.height / 2;
      const dx =
        direction === 'left'
          ? -120
          : direction === 'right'
            ? 120
            : direction === 'short'
              ? 15
              : 0;
      const dy = direction === 'vertical' ? -100 : 0;
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y }],
      });
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + dx, y: y + dy }],
      });
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
    }
    await swipe('right');
    await expect(photo).toHaveAttribute('alt', '湖畔の朝');
    await swipe('left');
    await expect(photo).toHaveAttribute('alt', '山へ続く道');
    await swipe('right');
    await expect(photo).toHaveAttribute('alt', '湖畔の朝');
    await swipe('short');
    await expect(photo).toHaveAttribute('alt', '湖畔の朝');
    const fixedY = (await page.locator('.swipe-photo-stage').boundingBox())?.y;
    await swipe('vertical');
    await expect(photo).toHaveAttribute('alt', '湖畔の朝');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect((await page.locator('.swipe-photo-stage').boundingBox())?.y).toBe(
      fixedY,
    );
    await page.mouse.wheel(0, 400);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await photo.tap();
    await expect(
      page.getByRole('button', { name: '次の写真', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '前の写真', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: '次の写真', exact: true }).tap();
    await expect(photo).toHaveAttribute('alt', '山へ続く道');
    await page.getByRole('button', { name: '次の写真', exact: true }).tap();
    await expect(photo).toHaveAttribute('alt', '青い時間');
    await page.getByRole('button', { name: '前の写真', exact: true }).tap();
    await expect(photo).toHaveAttribute('alt', '山へ続く道');
    await photo.tap();
    await expect(page.locator('.previous-photo, .next-photo')).toHaveCount(0);
    await page.keyboard.press('ArrowLeft');
    await expect(photo).toHaveAttribute('alt', '湖畔の朝');
    await page.keyboard.press('ArrowRight');
    await expect(photo).toHaveAttribute('alt', '山へ続く道');
    await page.getByRole('button', { name: '写真の情報', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: '写真の情報', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.info-panel')).toContainText('山へ続く道');
  });
  test('アルバムから開いてスワイプ・矢印で進んでも元のアルバムへ戻る', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(story('album'));
    await page
      .getByRole('button', { name: '湖畔の朝を開く', exact: true })
      .tap();
    const photo = page.locator('.detail-image');
    await expect(photo).toHaveAttribute('alt', '湖畔の朝');
    const originalStage = await page
      .locator('.swipe-photo-stage')
      .elementHandle();
    const originalImage = await photo.elementHandle();
    const touch = await page.context().newCDPSession(page);
    for (const name of ['山へ続く道', '青い時間']) {
      const bounds = await page.locator('.swipe-photo-stage').boundingBox();
      if (!bounds) throw new Error('写真が表示されていません');
      const x = bounds.x + bounds.width / 2,
        y = bounds.y + bounds.height / 2;
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y }],
      });
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x - 120, y }],
      });
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await expect(photo).toHaveAttribute('alt', name);
    }
    await photo.tap();
    await page.getByRole('button', { name: '次の写真', exact: true }).tap();
    await expect(photo).toHaveAttribute('alt', '旅先の風景');
    expect(await originalStage?.evaluate((node) => node.isConnected)).toBe(
      true,
    );
    expect(await originalImage?.evaluate((node) => node.isConnected)).toBe(
      true,
    );
    await page.getByRole('button', { name: '戻る', exact: true }).tap();
    await expect(
      page.getByRole('heading', { name: '秋の小旅行', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.photo-grid > .photo-tile')).toHaveCount(8);
    await expect(page.locator('.detail-image')).toHaveCount(0);
  });
});
