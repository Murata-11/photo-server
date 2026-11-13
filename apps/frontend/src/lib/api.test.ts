import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../mocks/handlers';
import { bulkFixture, resetStore, trashFixture } from '../mocks/scenarios';
import { api } from './api';
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  resetStore();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
// Node fetch requires absolute URLs; the production client intentionally uses same-origin paths.
function absoluteFetch() {
  const native = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
    native(new URL(String(input), 'http://localhost'), init),
  );
}
it('executes generated client against the OpenAPI MSW routes', async () => {
  absoluteFetch();
  expect((await api.list()).length).toBe(18);
  expect((await api.me()).displayName).toBe('Storybook利用者');
  expect(await api.albums()).toContain('秋の小旅行');
  expect(await api.createAlbum('新規')).toBe('新規');
  expect(await api.albums()).toContain('新規');
  const photo = await api.create(
    new File(['fixture'], 'test.png', { type: 'image/png' }),
  );
  expect(photo.name).toBe('test.png');
  expect(
    (
      await api.update(photo.id, {
        favorite: true,
        deleted: true,
      })
    ).favorite,
  ).toBe(true);
  await api.addAlbum(photo.id, '新規');
  await api.addAlbum(photo.id, '新規');
  expect((await api.list())[0]?.albums).toEqual(['新規']);
  await api.createAlbum('別所属');
  await api.addAlbum(photo.id, '別所属');
  await api.removeAlbum(photo.id, '新規');
  await api.removeAlbum(photo.id, '新規');
  expect((await api.list())[0]?.albums).toEqual(['別所属']);
  expect(await api.albums()).toContain('新規');
  await api.removeAlbum(photo.id, '別所属');
  expect((await api.list())[0]?.albums).toEqual([]);
  await expect(api.addAlbum(photo.id, '不存在')).rejects.toThrow();
  await expect(api.removeAlbum(photo.id, '不存在')).rejects.toThrow();
  expect((await api.list())[0]?.id).toBe(photo.id);
  await expect(api.update('missing', { favorite: true })).rejects.toThrow(
    '通信に失敗',
  );
  await expect(
    api.update(photo.id, { favorite: 'bad' } as unknown as Parameters<
      typeof api.update
    >[1]),
  ).rejects.toThrow('通信に失敗');
  resetStore('empty');
  expect(await api.list()).toEqual([]);
  resetStore('error');
  await expect(api.list()).rejects.toThrow('写真を読み込めませんでした');
});
it('rejects invalid mock bodies and has protected binary endpoint fixtures', async () => {
  const native = globalThis.fetch;
  for (const [path, method, body] of [
    ['/api/photos', 'POST', '{}'],
    ['/api/photos/1', 'PATCH', '{"other":1}'],
    ['/api/photos/1', 'PATCH', '{"album":false}'],
    ['/api/photos/1', 'PATCH', '{"deleted":"yes"}'],
  ] as const) {
    const response = await native('http://localhost' + path, {
      method,
      body,
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => null);
    expect(response?.status).toBe(400);
  }
  expect((await native('http://localhost/api/photos/1/original')).status).toBe(
    404,
  );
  expect((await native('http://localhost/api/photos/1/thumbnail')).status).toBe(
    404,
  );
});

it('一括追加は既存所属を保持し、再送と不正対象を安全に扱う', async () => {
  absoluteFetch();
  bulkFixture();
  const before = await api.list();
  const ids = before.slice(0, 2).map((p) => p.id);
  const name = (await api.albums())[0];
  const [firstId, secondId] = ids;
  if (!name || !firstId || !secondId) throw new Error('Missing fixture');
  await api.addPhotosAlbum({ photoIds: ids, name });
  await api.addPhotosAlbum({ photoIds: ids, name });
  const after = await api.list();
  for (const photo of before.slice(0, 2)) {
    expect(after.find((p) => p.id === photo.id)?.albums).toEqual(
      [...new Set([...photo.albums, name])].sort(),
    );
  }
  for (const photoIds of [
    [],
    [firstId, firstId],
    [firstId, '00000000-0000-4000-8000-999999999999'],
  ]) {
    await expect(api.addPhotosAlbum({ photoIds, name })).rejects.toThrow();
    expect(await api.list()).toEqual(after);
  }
  await api.update(secondId, { deleted: true });
  const trash = await api.list();
  await expect(api.addPhotosAlbum({ photoIds: ids, name })).rejects.toThrow(
    'ゴミ箱',
  );
  expect(await api.list()).toEqual(trash);
});
it('一括ゴミ箱のモック契約は入力・全件不変更・保持・冪等性を表す', async () => {
  absoluteFetch();
  bulkFixture();
  const before = await api.list();
  const first = before[0],
    second = before[1];
  if (!first || !second) throw new Error('Missing fixture');
  for (const body of [
    { photoIds: [] },
    { photoIds: Array.from({ length: 101 }, () => first.id) },
    { photoIds: [first.id, first.id] },
    { photoIds: ['bad'] },
    { photoIds: [first.id], extra: true },
    null,
  ]) {
    const response = await fetch('/api/photos/trash', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(400);
  }
  await expect(
    api.trashPhotos({
      photoIds: [first.id, 'ffffffff-ffff-4fff-8fff-ffffffffffff'],
    }),
  ).rejects.toThrow('存在しません');
  expect(await api.list()).toEqual(before);
  await api.trashPhotos({ photoIds: [first.id, second.id] });
  await api.trashPhotos({ photoIds: [first.id, second.id] });
  const after = await api.list();
  expect(after.find((p) => p.id === first.id)).toEqual({
    ...first,
    deleted: true,
  });
  expect(after.find((p) => p.id === second.id)).toEqual({
    ...second,
    deleted: true,
  });
  expect(after.slice(2)).toEqual(before.slice(2));
});

it('一括移動の失敗・応答喪失・再取得失敗シナリオを契約に沿って操作できる', async () => {
  absoluteFetch();
  for (const mode of ['error', 'unknown', 'refresh', 'missing'] as const) {
    trashFixture(mode);
    const before = await api.list();
    const id = before[0]?.id;
    if (!id) throw new Error('Missing fixture');
    if (mode === 'refresh') {
      await api.trashPhotos({ photoIds: [id] });
      await expect(api.list()).rejects.toThrow('読み込めません');
      expect((await api.list())[0]?.deleted).toBe(true);
    } else {
      await expect(api.trashPhotos({ photoIds: [id] })).rejects.toThrow();
      if (mode === 'unknown') {
        await api.trashPhotos({ photoIds: [id] });
        expect((await api.list())[0]?.deleted).toBe(true);
      } else expect(await api.list()).toEqual(before);
    }
  }
});

it('アルバムだけを削除し、写真・ゴミ箱状態・他所属を保持する（モック契約）', async () => {
  absoluteFetch();
  const special = ' . / 旅行?#%・😀 ';
  await api.createAlbum(special);
  const first = (await api.list())[0];
  if (!first) throw new Error('Missing fixture');
  await api.addAlbum(first.id, special);
  await api.update(first.id, { deleted: true });
  const before = await api.list();
  await api.deleteAlbum(special);
  await api.deleteAlbum(special);
  expect(await api.albums()).not.toContain(special);
  expect(await api.list()).toEqual(
    before.map((photo) => ({
      ...photo,
      albums: photo.albums.filter((name) => name !== special),
    })),
  );
  await expect(api.addAlbum(first.id, special)).rejects.toThrow();
  await api.createAlbum(special);
  expect(
    (await api.list()).every((photo) => !photo.albums.includes(special)),
  ).toBe(true);
  await api.deleteAlbum(special);
  for (const body of [
    null,
    {},
    { name: '' },
    { name: 'a'.repeat(101) },
    { name: 1 },
    { name: '旅', extra: true },
  ]) {
    const response = await fetch('/api/albums', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(400);
  }
});
