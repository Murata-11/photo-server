import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { components } from '../src/lib/api.generated';
type Photo = components['schemas']['Photo'];

test('実APIでアルバムだけを削除し、写真保持・結果確認・再取得・空アルバムを扱う', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const headers = { Origin: 'http://127.0.0.1:3000', 'X-Photo-Request': '1' };
  const prefix = `delete-${info.project.name}-${Date.now()}`;
  const target = prefix + '-旅行 / ..?#%',
    other = prefix + '-残す',
    empty = prefix + '-空',
    failed = prefix + '-再確認';
  const source = await readFile('public/photos/01.jpg');
  const photos: Photo[] = [];
  for (const suffix of ['normal', 'trash', 'untouched']) {
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
  for (const name of [target, other, empty, failed]) {
    expect(
      (
        await page.request.post('/api/albums', { headers, data: { name } })
      ).status(),
    ).toBe(200);
  }
  for (const photo of photos) {
    for (const name of photo.id === c.id ? [other] : [target, other]) {
      expect(
        (
          await page.request.put(`/api/photos/${photo.id}/albums`, {
            headers,
            data: { name },
          })
        ).status(),
      ).toBe(204);
    }
  }
  expect(
    (
      await page.request.patch(`/api/photos/${b.id}`, {
        headers,
        data: { favorite: true, deleted: true },
      })
    ).status(),
  ).toBe(200);
  const list = async () =>
    ((await (await page.request.get('/api/photos')).json()) as Photo[]).filter(
      (photo) => photos.some((p) => p.id === photo.id),
    );
  const before = await list();
  const thumbnails = new Map<string, Buffer>();
  for (const photo of photos)
    thumbnails.set(photo.id, await (await page.request.get(photo.src)).body());
  const albums = async () => {
    await page
      .getByRole('link', { name: 'アルバム', exact: true })
      .last()
      .click();
  };
  const card = (name: string) =>
    page
      .locator('.album-card')
      .filter({ has: page.getByRole('heading', { name, exact: true }) });
  const dialog = page.getByRole('dialog');
  const openDelete = async (name: string) => {
    await card(name).click();
    await page
      .getByRole('button', { name: 'アルバムを削除', exact: true })
      .click();
  };
  await page.goto('/');
  await albums();
  await openDelete(target);
  await expect(dialog.getByText(`「${target}」`)).toBeVisible();
  await expect(dialog.getByText(/写真は削除されません/)).toBeVisible();
  await page.screenshot({
    path: `../../work/issue51-real-confirm-${info.project.name}.png`,
  });
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
  expect(await list()).toEqual(before);
  await page
    .getByRole('button', { name: 'アルバムを削除', exact: true })
    .click();
  let deletes = 0;
  page.on('request', (request) => {
    if (request.method() === 'DELETE' && request.url().endsWith('/api/albums'))
      deletes++;
  });
  // Commit to the real DB, then lose the response. Checking the result must not resend deletion.
  await page.route(
    '**/api/albums',
    async (route) => {
      if (route.request().method() !== 'DELETE') return route.continue();
      expect((await route.fetch()).status()).toBe(204);
      await route.abort();
    },
    { times: 1 },
  );
  await dialog.getByRole('button', { name: 'このアルバムを削除' }).click();
  await expect(dialog.getByRole('alert')).toContainText('結果が不明');
  expect(await (await page.request.get('/api/albums')).json()).not.toContain(
    target,
  );
  await dialog.getByRole('button', { name: '削除結果を確認' }).click();
  await expect(dialog).toHaveCount(0);
  expect(deletes).toBe(1);
  await expect(card(target)).toHaveCount(0);
  await expect(card(other)).toContainText('2枚の写真');
  expect(await list()).toEqual(
    before.map((photo) => ({
      ...photo,
      albums: photo.albums.filter((name) => name !== target),
    })),
  );

  await openDelete(empty);
  // Only the post-delete read fails. Retry must send reads, never another DELETE.
  await page.route('**/api/photos', (route) => route.abort(), { times: 1 });
  await dialog.getByRole('button', { name: 'このアルバムを削除' }).click();
  await expect(dialog.getByRole('alert')).toContainText('削除は完了');
  const count = deletes;
  await dialog.getByRole('button', { name: '再取得', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(deletes).toBe(count);
  await expect(card(empty)).toHaveCount(0);

  await openDelete(failed);
  await page.route(
    '**/api/albums',
    (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"message":"通信エラー"}',
      }),
    { times: 1 },
  );
  await dialog.getByRole('button', { name: 'このアルバムを削除' }).click();
  await expect(dialog.getByRole('alert')).toContainText('結果が不明');
  const failedCount = deletes;
  await dialog.getByRole('button', { name: '削除結果を確認' }).click();
  await expect(dialog.getByRole('alert')).toContainText('作り直された可能性');
  expect(deletes).toBe(failedCount);
  await dialog.getByRole('button', { name: 'このアルバムを削除' }).click();
  await expect(dialog).toHaveCount(0);
  expect(deletes).toBe(failedCount + 1);
  await page.reload();
  await albums();
  for (const name of [target, empty, failed])
    await expect(card(name)).toHaveCount(0);
  await expect(card(other)).toContainText('2枚の写真');
  for (const photo of photos) {
    expect(await (await page.request.get(photo.originalUrl)).body()).toEqual(
      source,
    );
    expect(await (await page.request.get(photo.src)).body()).toEqual(
      thumbnails.get(photo.id),
    );
  }
  await page.getByRole('link', { name: 'フォト', exact: true }).last().click();
  await page
    .getByRole('button', { name: `${a.name}を開く`, exact: true })
    .click();
  await page
    .getByRole('button', { name: 'アルバムに追加・解除', exact: true })
    .click();
  await expect(
    page.getByRole('checkbox', { name: target, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('checkbox', { name: other, exact: true }),
  ).toBeChecked();
});
