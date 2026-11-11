import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createApp } from './app.js';
import { database, migrate } from './store.js';

// Separate throwaway database only; never fall back to DATABASE_URL.
const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw new Error('TEST_DATABASE_URL must point to a disposable database');
const pool = database(url);
const users = ['first@example.test', 'second@example.test'];
let dataDir: string;
const origin = 'https://photos.example.test';
let app: ReturnType<typeof createApp>;
let bytes: Buffer;
function request(
  path: string,
  method = 'GET',
  body?: BodyInit,
  user: string | null = users[0] ?? null,
  extra: Record<string, string> = {},
) {
  return app.request(path, {
    method,
    body,
    headers: {
      ...(user ? { 'Tailscale-User-Login': user } : {}),
      ...(method === 'GET' ? {} : { Origin: origin, 'X-Photo-Request': '1' }),
      ...extra,
    },
  });
}
function upload(
  content: Buffer = bytes,
  type = 'image/png',
  name = 'test.png',
) {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(content)], name, { type }));
  return request('/api/photos', 'POST', form);
}
async function add() {
  const response = await upload();
  expect(response.status).toBe(200);
  return response.json() as Promise<{
    id: string;
    src: string;
    originalUrl: string;
    name: string;
  }>;
}
beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'photo-test-'));
  await migrate(pool);
  bytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#9ac' },
  })
    .png()
    .toBuffer();
});
beforeEach(async () => {
  await pool.query('TRUNCATE photo_albums,photos,albums');
  app = createApp({ pool, dataDir, origin, users });
});
afterAll(async () => {
  await pool.end();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});
function membership(id: string, name: string, method = 'PUT', user = users[0]) {
  return request(
    `/api/photos/${id}/albums`,
    method,
    JSON.stringify({ name }),
    user,
    { 'Content-Type': 'application/json' },
  );
}
async function album(name: string) {
  expect(
    (
      await request('/api/albums', 'POST', JSON.stringify({ name }), users[0], {
        'Content-Type': 'application/json',
      })
    ).status,
  ).toBe(200);
}
describe('authenticated photo application with real PostgreSQL and files', () => {
  it('rejects missing, unknown and Funnel identities for every resource', async () => {
    const photo = await add();
    for (const path of [
      '/api/photos',
      '/api/albums',
      '/api/me',
      photo.src,
      photo.originalUrl,
    ]) {
      expect((await request(path, 'GET', undefined, null)).status).toBe(401);
      expect(
        (await request(path, 'GET', undefined, 'third@example.test')).status,
      ).toBe(403);
      expect(
        (
          await request(path, 'GET', undefined, users[0], {
            'Tailscale-Funnel-Request': '?1',
          })
        ).status,
      ).toBe(403);
    }
  });
  it('requires exact Origin and a custom header for mutations', async () => {
    const photo = await add();
    for (const headers of [
      { Origin: 'https://attacker.test', 'X-Photo-Request': '1' },
      { Origin: '', 'X-Photo-Request': '1' },
      { Origin: origin, 'X-Photo-Request': '' },
    ])
      expect(
        (
          await request(
            '/api/photos/' + photo.id,
            'PATCH',
            JSON.stringify({ deleted: true }),
            users[0],
            { 'Content-Type': 'application/json', ...headers },
          )
        ).status,
      ).toBe(403);
  });
  it('shares, persists, downloads original bytes and strips thumbnail metadata', async () => {
    const tagged = await sharp(bytes)
      .withExif({
        IFD0: { Artist: 'private fixture' },
        IFD2: { DateTimeOriginal: '2026:10:20 13:14:15' },
      })
      .jpeg()
      .toBuffer();
    const response = await upload(tagged, 'image/jpeg', '旅行.jpg');
    expect(response.status).toBe(200);
    const photo = (await response.json()) as {
      id: string;
      originalUrl: string;
      src: string;
    };
    app = createApp({ pool, dataDir, origin, users });
    const list = await request('/api/photos', 'GET', undefined, users[1]);
    expect(await list.json()).toEqual([
      expect.objectContaining({
        id: photo.id,
        name: '旅行.jpg',
        favorite: false,
        deleted: false,
      }),
    ]);
    const download = await request(
      photo.originalUrl,
      'GET',
      undefined,
      users[1],
    );
    expect(Buffer.from(await download.arrayBuffer())).toEqual(tagged);
    expect(download.headers.get('cache-control')).toBe('private, no-store');
    expect(download.headers.get('content-disposition')).toContain(
      'filename*=UTF-8',
    );
    const thumb = await request(photo.src);
    const info = await sharp(Buffer.from(await thumb.arrayBuffer())).metadata();
    expect(info.format).toBe('jpeg');
    expect(info.exif).toBeUndefined();
    const metadata = await pool.query<{
      metadata: { status: string; takenAtLocal: string };
    }>('SELECT metadata FROM photos WHERE id=$1', [photo.id]);
    expect(metadata.rows[0]?.metadata.takenAtLocal).toBe('2026-10-20T13:14:15');
  });
  it('persists empty albums, favorites, membership, trash and restore for either user', async () => {
    const photo = await add();
    expect(
      (
        await request(
          '/api/albums',
          'POST',
          JSON.stringify({ name: '夏休み' }),
          users[0],
          { 'Content-Type': 'application/json' },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          '/api/albums',
          'POST',
          JSON.stringify({ name: '夏休み' }),
          users[0],
          { 'Content-Type': 'application/json' },
        )
      ).status,
    ).toBe(409);
    for (const body of [
      { favorite: true },
      { deleted: true },
      { deleted: false },
    ])
      expect(
        (
          await request(
            '/api/photos/' + photo.id,
            'PATCH',
            JSON.stringify(body),
            users[1],
            { 'Content-Type': 'application/json' },
          )
        ).status,
      ).toBe(200);
    expect((await membership(photo.id, '夏休み')).status).toBe(204);
    app = createApp({ pool, dataDir, origin, users });
    expect(await (await request('/api/albums')).json()).toEqual(['夏休み']);
    expect(await (await request('/api/photos')).json()).toEqual([
      expect.objectContaining({
        favorite: true,
        albums: ['夏休み'],
        deleted: false,
      }),
    ]);
  });
  it('accepts exactly 50MiB and rejects files or bodies over the limit', async () => {
    const jpeg = await sharp(bytes).jpeg().toBuffer();
    const content = Buffer.alloc(50 * 1024 * 1024);
    jpeg.copy(content);
    const response = await upload(content, 'image/jpeg', 'limit.jpg');
    expect(response.status).toBe(200);
    const photo = (await response.json()) as { id: string };
    expect(
      (await readFile(join(dataDir, photo.id + '.original'))).equals(content),
    ).toBe(true);
    expect((await upload(Buffer.alloc(50 * 1024 * 1024 + 1))).status).toBe(413);
    expect((await upload(Buffer.alloc(51 * 1024 * 1024 + 1))).status).toBe(413);
  }, 15000);
  it('validates real image content, fields, ids and albums', async () => {
    expect((await upload(Buffer.from('bad image'))).status).toBe(422);
    expect((await upload(bytes, 'image/jpeg')).status).toBe(422);
    expect((await upload(bytes, 'image/svg+xml')).status).toBe(415);
    expect((await upload(Buffer.alloc(0))).status).toBe(422);
    expect((await request('/api/photos', 'POST', new FormData())).status).toBe(
      400,
    );
    expect((await request('/api/photos', 'POST', 'not multipart')).status).toBe(
      400,
    );
    const photo = await add();
    for (const body of [
      { favorite: 'yes' },
      { album: 'missing' },
      { extra: 1 },
      {},
      [],
      null,
    ])
      expect(
        (
          await request(
            '/api/photos/' + photo.id,
            'PATCH',
            JSON.stringify(body),
            users[0],
            { 'Content-Type': 'application/json' },
          )
        ).status,
      ).toBe(400);
    expect(
      (await request('/api/photos/' + photo.id, 'PATCH', '{')).status,
    ).toBe(400);
    expect((await request('/api/photos/invalid/thumbnail')).status).toBe(400);
    expect(
      (
        await request(
          '/api/photos/00000000-0000-0000-0000-000000000000/original',
        )
      ).status,
    ).toBe(404);
    expect((await request('/api/photos/invalid', 'PATCH', '{}')).status).toBe(
      400,
    );
    expect(
      (
        await request(
          '/api/photos/00000000-0000-0000-0000-000000000000',
          'PATCH',
          '{"deleted":true}',
        )
      ).status,
    ).toBe(404);
    for (const body of [
      { name: '' },
      { name: 'x'.repeat(101) },
      { name: 'ok', other: 1 },
      [],
    ])
      expect(
        (await request('/api/albums', 'POST', JSON.stringify(body))).status,
      ).toBe(400);
  });
  it('does not treat filenames as filesystem paths', async () => {
    const response = await upload(bytes, 'image/png', '../../secret.png');
    expect(response.status).toBe(200);
    const photo = (await response.json()) as { id: string; name: string };
    expect(photo.name).not.toContain('/');
    expect(await readFile(join(dataDir, photo.id + '.original'))).toEqual(
      bytes,
    );
  });
  it('fails closed when configuration is incomplete', () => {
    expect(() => createApp({ pool, dataDir, origin, users: [] })).toThrow();
    expect(() =>
      createApp({
        pool,
        dataDir,
        origin,
        users: [users[0] ?? '', users[0] ?? ''],
      }),
    ).toThrow();
    expect(() =>
      createApp({ pool, dataDir, origin, users, devUser: 'unknown' }),
    ).toThrow();
  });
});

describe('multiple album membership contract', () => {
  it('keeps distinct concurrent additions, is idempotent, preserves files and survives reconnect', async () => {
    const p = await add();
    await album('A');
    await album('B');
    await album('Empty');
    const responses = await Promise.all([
      membership(p.id, 'A'),
      membership(p.id, 'B', 'PUT', users[1]),
    ]);
    expect(responses.map((r) => r.status)).toEqual([204, 204]);
    expect(await responses[0]?.text()).toBe('');
    expect((await membership(p.id, 'A')).status).toBe(204);
    expect((await pool.query('SELECT * FROM photo_albums')).rowCount).toBe(2);
    const reconnected = database(url ?? '');
    try {
      const restarted = createApp({
        pool: reconnected,
        dataDir,
        origin,
        users,
      });
      const list = await restarted.request('/api/photos', {
        headers: { 'Tailscale-User-Login': users[1] ?? '' },
      });
      expect(await list.json()).toEqual([
        expect.objectContaining({ id: p.id, albums: ['A', 'B'] }),
      ]);
    } finally {
      await reconnected.end();
    }
    expect((await membership(p.id, 'A', 'DELETE')).status).toBe(204);
    expect((await membership(p.id, 'A', 'DELETE')).status).toBe(204);
    expect(await (await request('/api/photos')).json()).toEqual([
      expect.objectContaining({ albums: ['B'] }),
    ]);
    expect(await (await request('/api/albums')).json()).toEqual([
      'A',
      'B',
      'Empty',
    ]);
    expect(
      Buffer.from(await (await request(p.originalUrl)).arrayBuffer()),
    ).toEqual(bytes);
    for (const deleted of [true, false]) {
      expect(
        (
          await request(
            '/api/photos/' + p.id,
            'PATCH',
            JSON.stringify({ deleted, favorite: true }),
          )
        ).status,
      ).toBe(200);
      expect(await (await request('/api/photos')).json()).toEqual([
        expect.objectContaining({ deleted, favorite: true, albums: ['B'] }),
      ]);
    }
  });
  it('serializes competing membership operations behind the photo lock', async () => {
    const p = await add();
    await album('A');
    await album('B');
    await membership(p.id, 'A');
    const lock = await pool.connect();
    await lock.query('BEGIN');
    await lock.query('SELECT id FROM photos WHERE id=$1 FOR UPDATE', [p.id]);
    const addA = membership(p.id, 'A'),
      removeA = membership(p.id, 'A', 'DELETE'),
      addB = membership(p.id, 'B', 'PUT', users[1]);
    await lock.query('COMMIT');
    lock.release();
    expect(
      (await Promise.all([addA, removeA, addB])).map((r) => r.status),
    ).toEqual([204, 204, 204]);
    const rows = await pool.query<{ album_name: string }>(
      'SELECT album_name FROM photo_albums WHERE photo_id=$1',
      [p.id],
    );
    expect(rows.rows.map((r) => r.album_name)).toContain('B');
    expect(rows.rowCount).toBeLessThanOrEqual(2);
  });
  it('validates new endpoints, rejects old writes and protects both methods', async () => {
    const p = await add();
    await album('A');
    const missing = '00000000-0000-0000-0000-000000000000';
    for (const method of ['PUT', 'DELETE']) {
      expect((await membership('bad', 'A', method)).status).toBe(400);
      expect((await membership(missing, 'A', method)).status).toBe(404);
      expect((await membership(p.id, 'missing', method)).status).toBe(404);
      for (const body of [
        '{',
        'null',
        '[]',
        '{}',
        '{"name":""}',
        '{"name":1}',
        '{"name":"A","extra":1}',
        JSON.stringify({ name: 'x'.repeat(101) }),
      ])
        expect(
          (await request(`/api/photos/${p.id}/albums`, method, body)).status,
        ).toBe(400);
      for (const [user, status] of [
        [null, 401],
        ['stranger', 403],
      ] as const)
        expect(
          (
            await request(
              `/api/photos/${p.id}/albums`,
              method,
              '{"name":"A"}',
              user,
            )
          ).status,
        ).toBe(status);
      expect(
        (
          await request(
            `/api/photos/${p.id}/albums`,
            method,
            '{"name":"A"}',
            users[0],
            { Origin: 'https://attacker.test' },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            `/api/photos/${p.id}/albums`,
            method,
            '{"name":"A"}',
            users[0],
            { 'X-Photo-Request': '' },
          )
        ).status,
      ).toBe(403);
    }
    expect(
      (await request('/api/photos/' + p.id, 'PATCH', '{"album":"A"}')).status,
    ).toBe(400);
    await request('/api/photos/' + p.id, 'PATCH', '{"deleted":true}');
    expect((await membership(p.id, 'A')).status).toBe(204);
    expect((await membership(p.id, 'A', 'DELETE')).status).toBe(204);
  });
});
