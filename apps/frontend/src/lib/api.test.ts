import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../mocks/handlers';
import { bulkFixture, resetStore } from '../mocks/scenarios';
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
