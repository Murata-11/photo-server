import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { components } from '../src/lib/api.generated';
type Photo = components['schemas']['Photo'];

test('実APIの一括ゴミ箱はキャンセル・応答喪失の再送・表紙更新・復元・再取得失敗を扱う', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const headers = { Origin: 'http://127.0.0.1:3000', 'X-Photo-Request': '1' };
  const prefix = `trash-${info.project.name}-${Date.now()}`;
  const source = await readFile('public/photos/01.jpg');
  const photos: Photo[] = [];
  for (const suffix of ['first', 'second', 'untouched']) {
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
  const [a, b, c] = photos;
  if (!a || !b || !c) throw new Error('Missing fixtures');
  const album = prefix + '-A',
    other = prefix + '-B';
  for (const name of [album, other]) {
    expect(
      (
        await page.request.post('/api/albums', { headers, data: { name } })
      ).status(),
    ).toBe(200);
    for (const photo of name === album ? photos : [a, b])
      expect(
        (
          await page.request.put(`/api/photos/${photo.id}/albums`, {
            headers,
            data: { name },
          })
        ).status(),
      ).toBe(204);
  }
  const list = async () =>
    ((await (await page.request.get('/api/photos')).json()) as Photo[]).filter(
      (photo) => photos.some((p) => p.id === photo.id),
    );
  const before = await list();
  const albumsPage = async () => {
    await page
      .getByRole('link', { name: 'アルバム', exact: true })
      .last()
      .click();
  };
  const card = (name: string) =>
    page
      .getByRole('button')
      .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await page.goto('/');
  await albumsPage();
  await card(album).click();
  await page
    .getByRole('button', { name: `${a.name}を開く`, exact: true })
    .press('Shift+Enter');
  for (const photo of [b])
    await page
      .getByRole('button', { name: `${photo.name}を選択`, exact: true })
      .click();
  const trigger = page.getByRole('button', {
    name: 'ゴミ箱に移動',
    exact: true,
  });
  await expect(trigger).toContainText('ゴミ箱に移動');
  await page.screenshot({
    path: `../../work/issue26-real-selection-${info.project.name}.png`,
  });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/所属解除ではありません/)).toBeVisible();
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(page.getByRole('status', { name: '2枚を選択中' })).toBeVisible();
  expect(await list()).toEqual(before);
  await trigger.click();
  let puts = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'PUT' &&
      request.url().endsWith('/api/photos/trash')
    )
      puts++;
  });
  await page.route(
    '**/api/photos/trash',
    async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(204);
      await route.abort();
    },
    { times: 1 },
  );
  await dialog
    .getByRole('button', { name: 'ゴミ箱に移動', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toContainText('結果が不明');
  expect(
    (await list())
      .filter((photo) => photo.deleted)
      .map((photo) => photo.id)
      .sort(),
  ).toEqual([a.id, b.id].sort());
  await dialog
    .getByRole('button', { name: '同じ対象を再試行', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(puts).toBe(2);
  await expect(
    page.getByRole('button', { name: `${a.name}を開く`, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: `${c.name}を開く`, exact: true }),
  ).toBeVisible();
  await albumsPage();
  await expect(card(album)).toContainText('1枚の写真');
  await expect(card(album).locator('img')).toHaveAttribute('src', c.src);
  await expect(card(other)).toContainText('0枚の写真');
  await page.reload();
  await page
    .getByRole('button', { name: 'アカウントメニュー', exact: true })
    .click();
  await page.getByRole('link', { name: 'ゴミ箱', exact: true }).click();
  await page
    .getByRole('button', { name: `${a.name}を開く`, exact: true })
    .press('Shift+Enter');
  await expect(
    page.getByRole('button', { name: 'ゴミ箱に移動', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '選択解除' }).click();
  await page
    .getByRole('button', { name: `${a.name}を開く`, exact: true })
    .click();
  await page.getByRole('button', { name: '復元', exact: true }).click();
  await albumsPage();
  await expect(card(album)).toContainText('2枚の写真');
  await expect(card(other)).toContainText('1枚の写真');
  await card(other).click();
  await page
    .getByRole('button', { name: `${a.name}を開く`, exact: true })
    .press('Shift+Enter');
  await trigger.click();
  // Saving succeeds; lose only the next list response, then retry reads alone.
  await page.route(
    '**/api/photos',
    async (route) => {
      await route.abort();
    },
    { times: 1 },
  );
  await dialog
    .getByRole('button', { name: 'ゴミ箱に移動', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toContainText('移動は完了');
  const count = puts;
  await dialog.getByRole('button', { name: '再取得', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(puts).toBe(count);
  await page.reload();
  const after = await list();
  expect(after.find((photo) => photo.id === c.id)).toEqual(
    before.find((photo) => photo.id === c.id),
  );
  for (const photo of [a, b]) {
    expect(after.find((p) => p.id === photo.id)).toEqual(
      expect.objectContaining({ deleted: true, albums: [album, other] }),
    );
    expect(await (await page.request.get(photo.originalUrl)).body()).toEqual(
      source,
    );
  }
  await page.screenshot({
    path: `../../work/issue26-real-complete-${info.project.name}.png`,
  });
});
