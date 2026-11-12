import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { components } from '../src/lib/api.generated';
type Photo = components['schemas']['Photo'];

test('実APIで一括追加・競合失敗・応答喪失・再取得失敗から安全に再試行する', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const headers = { Origin: 'http://127.0.0.1:3000', 'X-Photo-Request': '1' };
  const prefix = `bulk-${info.project.name}-${Date.now()}`;
  const source = await readFile('public/photos/01.jpg');
  const photos: Photo[] = [];
  for (const suffix of ['first', 'second']) {
    const response = await page.request.post('/api/photos', {
      headers,
      multipart: {
        file: {
          name: `${prefix}-${suffix}.jpg`,
          mimeType: 'image/jpeg',
          buffer: source,
        },
      },
    });
    expect(response.status()).toBe(200);
    photos.push((await response.json()) as Photo);
  }
  const [first, second] = photos;
  if (!first || !second) throw new Error('Missing fixture');
  const album = prefix + '-追加先',
    other = prefix + '-既存';
  for (const name of [album, other])
    expect(
      (
        await page.request.post('/api/albums', { headers, data: { name } })
      ).status(),
    ).toBe(200);
  expect(
    (
      await page.request.put(`/api/photos/${first.id}/albums`, {
        headers,
        data: { name: other },
      })
    ).status(),
  ).toBe(204);
  const list = async () =>
    ((await (await page.request.get('/api/photos')).json()) as Photo[]).filter(
      (p) => photos.some((f) => f.id === p.id),
    );
  const patch = async (deleted: boolean) =>
    expect(
      (
        await page.request.patch(`/api/photos/${first.id}`, {
          headers,
          data: { deleted },
        })
      ).status(),
    ).toBe(200);
  const select = async () => {
    await page
      .getByRole('button', { name: first.name + 'を開く', exact: true })
      .press('Shift+Enter');
    for (const photo of photos.slice(1))
      await page
        .getByRole('button', { name: photo.name + 'を選択', exact: true })
        .click();
    await page
      .getByRole('button', { name: 'アルバムに追加', exact: true })
      .click();
    await page.getByRole('combobox').selectOption(album);
  };
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: '写真を検索' })).toHaveCount(
    0,
  );
  await select();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('status', { name: '2枚を選択中' })).toBeVisible();
  expect((await list()).find((p) => p.id === first.id)?.albums).toEqual([
    other,
  ]);
  await page
    .getByRole('button', { name: 'アルバムに追加', exact: true })
    .click();
  await page.getByRole('combobox').selectOption(album);
  // Another client moves a selected photo to trash after this screen loaded.
  await patch(true);
  await page.getByRole('button', { name: '追加', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ゴミ箱');
  expect((await list()).every((p) => !p.albums.includes(album))).toBe(true);
  await patch(false);
  // Lose the response after the real server has committed. Retrying must not duplicate.
  await page.route(
    '**/api/photos/albums',
    async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(204);
      await route.abort();
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: '再試行', exact: true }).click();
  await expect
    .poll(async () => (await list()).every((p) => p.albums.includes(album)))
    .toBe(true);
  await expect(page.getByRole('alert')).toContainText('結果が不明');
  await page.getByRole('button', { name: '再試行', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const p of await list())
    expect(p.albums.filter((n) => n === album)).toHaveLength(1);
  expect((await list()).find((p) => p.id === first.id)?.albums).toContain(
    other,
  );
  await page.reload();
  await expect(page.getByRole('textbox', { name: '写真を検索' })).toHaveCount(
    0,
  );
  await select();
  let puts = 0;
  page.on('request', (req) => {
    if (req.method() === 'PUT' && req.url().endsWith('/api/photos/albums'))
      puts++;
  });
  // Acknowledge saving, fail only the following read, then retry reads alone.
  await page.route(
    '**/api/photos',
    async (route) => {
      if (route.request().method() === 'GET') await route.abort();
      else await route.continue();
    },
    { times: 1 },
  );
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    '**/api/photos/albums',
    async (route) => {
      await gate;
      await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: '追加', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText(
    '追加しています',
  );
  await expect(
    page.getByRole('button', { name: '追加', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('combobox')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  release?.();
  await expect(page.getByRole('alert')).toContainText('追加は完了');
  await page.getByRole('button', { name: '再取得', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(puts).toBe(1);
  await page
    .getByRole('link', { name: 'アルバム', exact: true })
    .last()
    .click();
  const card = page
    .getByRole('button')
    .filter({ has: page.getByRole('heading', { name: album, exact: true }) });
  await expect(card).toContainText('2枚の写真');
  const newest = (await list()).sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  )[0];
  if (!newest) throw new Error('Missing cover');
  await expect(card.locator('img')).toHaveAttribute('src', newest.src);
  await card.click();
  for (const photo of photos)
    await expect(
      page.getByRole('button', { name: photo.name + 'を開く', exact: true }),
    ).toBeVisible();
  await page.reload();
  for (const photo of photos) {
    await expect(
      page.getByRole('button', { name: photo.name + 'を開く', exact: true }),
    ).toBeVisible();
    expect(await (await page.request.get(photo.originalUrl)).body()).toEqual(
      source,
    );
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'アルバム', exact: true }).click();
  await card.click();
  await page
    .getByRole('button', { name: second.name + 'を開く', exact: true })
    .click();
  const stage = page.locator('.swipe-photo-stage');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Missing viewer');
  const beforeSwipe = await stage.locator('img').getAttribute('src');
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(stage.locator('img')).not.toHaveAttribute(
    'src',
    beforeSwipe ?? '',
  );
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: album, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `../../work/issue22-${info.project.name}.png`,
    fullPage: true,
  });
});
