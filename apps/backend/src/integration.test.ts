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
  await pool.query('TRUNCATE photos,albums');
  app = createApp({ pool, dataDir, origin, users });
});
afterAll(async () => {
  await pool.end();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});
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
      { favorite: true, album: '夏休み' },
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
    app = createApp({ pool, dataDir, origin, users });
    expect(await (await request('/api/albums')).json()).toEqual(['夏休み']);
    expect(await (await request('/api/photos')).json()).toEqual([
      expect.objectContaining({
        favorite: true,
        album: '夏休み',
        deleted: false,
      }),
    ]);
  });
  it('validates real image content, fields, ids and albums', async () => {
    expect((await upload(Buffer.from('bad image'))).status).toBe(422);
    expect((await upload(bytes, 'image/jpeg')).status).toBe(422);
    expect((await upload(bytes, 'image/svg+xml')).status).toBe(415);
    expect((await upload(Buffer.alloc(0))).status).toBe(422);
    expect((await upload(Buffer.alloc(10 * 1024 * 1024 + 1))).status).toBe(413);
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
