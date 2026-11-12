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
  it.each(['jpeg', 'png', 'webp'] as const)(
    'previews original %s inline with the same bytes and authorization',
    async (format) => {
      const original = await sharp(bytes).toFormat(format).toBuffer();
      const type = `image/${format}`;
      const uploaded = await upload(original, type, `旅行.${format}`);
      expect(uploaded.status).toBe(200);
      const photo = (await uploaded.json()) as {
        id: string;
        originalUrl: string;
      };
      const url = photo.originalUrl + '?disposition=inline';
      for (const user of users) {
        const preview = await request(url, 'GET', undefined, user);
        expect(preview.status).toBe(200);
        expect(preview.headers.get('content-type')).toBe(type);
        expect(preview.headers.get('content-disposition')).toMatch(/^inline;/);
        expect(preview.headers.get('content-disposition')).toContain(
          'filename*=UTF-8',
        );
        expect(preview.headers.get('cache-control')).toBe('private, no-store');
        expect(preview.headers.get('x-content-type-options')).toBe('nosniff');
        expect(Buffer.from(await preview.arrayBuffer())).toEqual(original);
      }
      expect((await request(url, 'GET', undefined, null)).status).toBe(401);
      expect(
        (await request(url, 'GET', undefined, 'unknown@example.test')).status,
      ).toBe(403);
      const download = await request(photo.originalUrl);
      expect(download.headers.get('content-disposition')).toMatch(
        /^attachment;/,
      );
      expect(Buffer.from(await download.arrayBuffer())).toEqual(original);
      expect(
        (
          await request(photo.originalUrl + '?disposition=attachment')
        ).headers.get('content-disposition'),
      ).toMatch(/^attachment;/);
      for (const value of ['unknown', ''])
        expect(
          (await request(photo.originalUrl + '?disposition=' + value)).status,
        ).toBe(400);
      await request(
        '/api/photos/' + photo.id,
        'PATCH',
        JSON.stringify({ deleted: true }),
        users[0],
        { 'Content-Type': 'application/json' },
      );
      expect(Buffer.from(await (await request(url)).arrayBuffer())).toEqual(
        original,
      );
    },
  );
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
  it('rejects HEIC and HEIF uploads before decoding or inserting a photo', async () => {
    for (const mime of ['image/heic', 'image/heif']) {
      const response = await upload(bytes, mime, 'unsupported.heif');
      expect(response.status).toBe(415);
      expect(await response.json()).toMatchObject({
        message: 'JPEG・PNG・WebPの静止画像を選んでください',
      });
    }
    expect(
      (await pool.query('SELECT count(*) AS count FROM photos')).rows[0].count,
    ).toBe('0');
  });
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

async function bulk(photoIds: string[], name: string, user = users[0]) {
  return request(
    '/api/photos/albums',
    'PUT',
    JSON.stringify({ photoIds, name }),
    user,
  );
}
describe('bulk album addition contract', () => {
  it('adds all photos, preserves other memberships, safely retries and persists across a new connection', async () => {
    const first = await add(),
      second = await add();
    await album('A');
    await album('B');
    await membership(first.id, 'B');
    const ids = [first.id, second.id];
    for (const user of users) {
      const response = await bulk(ids, 'A', user);
      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
    }
    expect((await pool.query('SELECT * FROM photo_albums')).rowCount).toBe(3);
    const connection = database(url ?? '');
    try {
      const restarted = createApp({ pool: connection, dataDir, origin, users });
      const response = await restarted.request('/api/photos', {
        headers: { 'Tailscale-User-Login': users[1] ?? '' },
      });
      expect(await response.json()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: first.id, albums: ['A', 'B'] }),
          expect.objectContaining({ id: second.id, albums: ['A'] }),
        ]),
      );
    } finally {
      await connection.end();
    }
    for (const photo of [first, second])
      expect(
        Buffer.from(await (await request(photo.originalUrl)).arrayBuffer()),
      ).toEqual(bytes);
  });
  it('validates bodies, count boundaries and identity/CSRF before changing anything', async () => {
    const photo = await add();
    await album('A');
    for (const body of [
      '{',
      'null',
      '[]',
      '{}',
      JSON.stringify({ photoIds: [], name: 'A' }),
      JSON.stringify({ photoIds: [photo.id, photo.id], name: 'A' }),
      JSON.stringify({
        photoIds: [photo.id, photo.id.toUpperCase()],
        name: 'A',
      }),
      JSON.stringify({ photoIds: ['bad'], name: 'A' }),
      JSON.stringify({ photoIds: [1], name: 'A' }),
      JSON.stringify({ photoIds: 'bad', name: 'A' }),
      JSON.stringify({ photoIds: [photo.id], name: 1 }),
      JSON.stringify({ photoIds: [photo.id], name: '' }),
      JSON.stringify({ photoIds: [photo.id], name: 'x'.repeat(101) }),
      JSON.stringify({ photoIds: [photo.id], name: 'A', extra: true }),
      JSON.stringify({
        photoIds: Array.from(
          { length: 101 },
          (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        ),
        name: 'A',
      }),
    ])
      expect((await request('/api/photos/albums', 'PUT', body)).status).toBe(
        400,
      );
    for (const [user, status] of [
      [null, 401],
      ['stranger', 403],
    ] as const)
      expect(
        (
          await request(
            '/api/photos/albums',
            'PUT',
            JSON.stringify({ photoIds: [photo.id], name: 'A' }),
            user,
          )
        ).status,
      ).toBe(status);
    for (const extra of [
      { Origin: 'https://attacker.test' },
      { 'X-Photo-Request': '' },
      { 'Tailscale-Funnel-Request': '?1' },
    ] as Array<Record<string, string>>)
      expect(
        (
          await request(
            '/api/photos/albums',
            'PUT',
            JSON.stringify({ photoIds: [photo.id], name: 'A' }),
            users[0],
            extra,
          )
        ).status,
      ).toBe(403);
    expect((await pool.query('SELECT * FROM photo_albums')).rowCount).toBe(0);
    expect((await bulk([photo.id], 'A')).status).toBe(204);
  });
  it('accepts 100 photos, unicode names and rejects missing or trashed entities without partial changes', async () => {
    const name = '旅'.repeat(100);
    await album(name);
    const rows = await pool.query<{
      id: string;
    }>(`INSERT INTO photos(id,filename,media_type,size_bytes,sha256,uploaded_by,metadata)
      SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'fixture.png','image/png',1,repeat('a',64),'fixture','{}'::jsonb FROM generate_series(1,100) n RETURNING id`);
    const ids = rows.rows.map((p) => p.id);
    expect((await bulk(ids, name)).status).toBe(204);
    await album('B');
    const first = ids[0];
    if (!first) throw new Error('Missing fixture');
    await request('/api/photos/' + first, 'PATCH', '{"deleted":true}');
    const missing = '00000000-0000-4000-8000-999999999999';
    expect((await bulk([...ids.slice(0, 99), missing], 'B')).status).toBe(404);
    expect((await bulk(ids, 'missing')).status).toBe(404);
    expect((await bulk(ids, 'B')).status).toBe(409);
    expect((await bulk(ids, ' B ')).status).toBe(404);
    expect(
      (await pool.query("SELECT * FROM photo_albums WHERE album_name='B'"))
        .rowCount,
    ).toBe(0);
    expect((await pool.query('SELECT * FROM photo_albums')).rowCount).toBe(100);
    await request('/api/photos/' + first, 'PATCH', '{"deleted":false}');
    expect((await bulk(ids, 'B')).status).toBe(204);
    expect((await pool.query('SELECT * FROM photo_albums')).rowCount).toBe(200);
  });
  it('rolls back the entire insertion when the database fails part way through', async () => {
    const first = await add(),
      second = await add();
    await album('A');
    await album('B');
    await membership(first.id, 'B');
    const ids = [first.id, second.id].sort();
    // Test-only trigger makes a later row fail after an earlier row was inserted.
    await pool.query(`CREATE FUNCTION issue22_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.photo_id::text = '${ids[1]}' AND NEW.album_name='A' THEN RAISE EXCEPTION 'test-only failure'; END IF;
      RETURN NEW; END $$`);
    await pool.query(
      'CREATE TRIGGER issue22_failure BEFORE INSERT ON photo_albums FOR EACH ROW EXECUTE FUNCTION issue22_fail()',
    );
    try {
      const response = await bulk(ids, 'A');
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain('test-only');
      expect(
        (await pool.query('SELECT photo_id,album_name FROM photo_albums')).rows,
      ).toEqual([{ photo_id: first.id, album_name: 'B' }]);
    } finally {
      await pool.query('DROP TRIGGER issue22_failure ON photo_albums');
      await pool.query('DROP FUNCTION issue22_fail()');
    }
    expect((await bulk(ids, 'A')).status).toBe(204);
  });
  it('serializes overlapping batches and individual membership operations without losing other albums', async () => {
    const first = await add(),
      second = await add();
    await album('A');
    await album('B');
    await album('C');
    const responses = await Promise.all([
      bulk([first.id, second.id], 'A'),
      bulk([second.id, first.id], 'B', users[1]),
      membership(first.id, 'C'),
    ]);
    expect(responses.map((r) => r.status)).toEqual([204, 204, 204]);
    expect(await (await request('/api/photos')).json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, albums: ['A', 'B', 'C'] }),
        expect.objectContaining({ id: second.id, albums: ['A', 'B'] }),
      ]),
    );
    expect((await membership(first.id, 'A', 'DELETE')).status).toBe(204);
    expect(await (await request('/api/photos')).json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, albums: ['B', 'C'] }),
      ]),
    );
  });
  it('waits for a concurrent trash move and refuses the entire batch after that move commits', async () => {
    const first = await add(),
      second = await add();
    await album('A');
    const lock = await pool.connect();
    let pending: Promise<Response> | undefined;
    try {
      await lock.query('BEGIN');
      await lock.query('UPDATE photos SET deleted=true WHERE id=$1', [
        first.id,
      ]);
      pending = bulk([first.id, second.id], 'A');
      await expect
        .poll(
          async () => {
            const waiting = await pool.query(
              `SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id,deleted FROM photos%'`,
            );
            return waiting.rows[0]?.count as number;
          },
          { timeout: 5000 },
        )
        .toBeGreaterThan(0);
      await lock.query('COMMIT');
      expect((await pending).status).toBe(409);
    } finally {
      await lock.query('ROLLBACK');
      lock.release();
      await pending;
    }
    expect((await pool.query('SELECT * FROM photo_albums')).rowCount).toBe(0);
  });
});

async function trash(photoIds: string[], user = users[0]) {
  return request(
    '/api/photos/trash',
    'PUT',
    JSON.stringify({ photoIds }),
    user,
  );
}
describe('bulk trash contract', () => {
  it('moves only targets, retains files and all other data, retries and restores after reconnecting', async () => {
    const first = await add(),
      second = await add(),
      untouched = await add();
    await album('A');
    await album('B');
    await membership(first.id, 'A');
    await membership(first.id, 'B');
    await request(`/api/photos/${first.id}`, 'PATCH', '{"favorite":true}');
    const before = (await pool.query('SELECT * FROM photos ORDER BY id')).rows;
    const files = new Map<string, Buffer>();
    for (const photo of [first, second, untouched]) {
      for (const suffix of ['original', 'jpg'])
        files.set(
          `${photo.id}.${suffix}`,
          await readFile(join(dataDir, `${photo.id}.${suffix}`)),
        );
    }
    expect((await trash([first.id.toUpperCase()])).status).toBe(204);
    for (const user of users) {
      const response = await trash([second.id, first.id], user);
      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
    }
    expect((await pool.query('SELECT * FROM photos ORDER BY id')).rows).toEqual(
      before.map((photo) => ({ ...photo, deleted: photo.id !== untouched.id })),
    );
    expect(
      (
        await pool.query(
          'SELECT album_name FROM photo_albums ORDER BY album_name',
        )
      ).rows,
    ).toEqual([{ album_name: 'A' }, { album_name: 'B' }]);
    for (const [file, content] of files)
      expect(await readFile(join(dataDir, file))).toEqual(content);
    const connection = database(url ?? '');
    try {
      const restarted = createApp({ pool: connection, dataDir, origin, users });
      const response = await restarted.request('/api/photos', {
        headers: { 'Tailscale-User-Login': users[1] ?? '' },
      });
      expect(await response.json()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: first.id,
            deleted: true,
            favorite: true,
            albums: ['A', 'B'],
          }),
          expect.objectContaining({ id: second.id, deleted: true }),
          expect.objectContaining({ id: untouched.id, deleted: false }),
        ]),
      );
    } finally {
      await connection.end();
    }
    expect(
      (await request(`/api/photos/${first.id}`, 'PATCH', '{"deleted":false}'))
        .status,
    ).toBe(200);
    expect(await (await request('/api/photos')).json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.id,
          deleted: false,
          albums: ['A', 'B'],
        }),
      ]),
    );
    expect(
      Buffer.from(await (await request(first.originalUrl)).arrayBuffer()),
    ).toEqual(bytes);
  });
  it('rejects invalid input, duplicate IDs, identities and CSRF without changing photos', async () => {
    const p = await add();
    const body = JSON.stringify({ photoIds: [p.id] });
    for (const input of [
      '{',
      'null',
      '[]',
      '1',
      '{}',
      JSON.stringify({ photoIds: [] }),
      JSON.stringify({ photoIds: 'bad' }),
      JSON.stringify({ photoIds: [1] }),
      JSON.stringify({ photoIds: ['bad'] }),
      JSON.stringify({ photoIds: [p.id, p.id.toUpperCase()] }),
      JSON.stringify({ photoIds: [p.id], extra: true }),
      JSON.stringify({
        photoIds: Array.from(
          { length: 101 },
          (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        ),
      }),
    ])
      expect((await request('/api/photos/trash', 'PUT', input)).status).toBe(
        400,
      );
    for (const [user, status] of [
      [null, 401],
      ['stranger', 403],
    ] as const)
      expect(
        (await request('/api/photos/trash', 'PUT', body, user)).status,
      ).toBe(status);
    for (const extra of [
      { Origin: '' },
      { Origin: 'https://attacker.test' },
      { 'X-Photo-Request': '' },
      { 'Tailscale-Funnel-Request': '?1' },
    ] as Array<Record<string, string>>)
      expect(
        (await request('/api/photos/trash', 'PUT', body, users[0], extra))
          .status,
      ).toBe(403);
    expect((await pool.query('SELECT deleted FROM photos')).rows).toEqual([
      { deleted: false },
    ]);
  });
  it('accepts 100 photos and keeps all unchanged when any target is missing', async () => {
    const result = await pool.query<{
      id: string;
    }>(`INSERT INTO photos(id,filename,media_type,size_bytes,sha256,uploaded_by,metadata)
      SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'fixture.png','image/png',1,repeat('a',64),'fixture','{}'::jsonb FROM generate_series(1,100) n RETURNING id`);
    const ids = result.rows.map((row) => row.id);
    expect(
      (
        await trash([
          ...ids.slice(0, 99),
          'ffffffff-ffff-4fff-8fff-ffffffffffff',
        ])
      ).status,
    ).toBe(404);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS count FROM photos WHERE deleted',
        )
      ).rows[0]?.count,
    ).toBe(0);
    expect((await trash(ids.reverse())).status).toBe(204);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS count FROM photos WHERE deleted',
        )
      ).rows[0]?.count,
    ).toBe(100);
    expect((await trash(ids)).status).toBe(204);
  });
  it('rolls back the entire batch if an update fails after an earlier update', async () => {
    const photos = [await add(), await add()];
    await pool.query(`CREATE FUNCTION issue26_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.deleted AND (SELECT count(*) FROM photos WHERE deleted)>0 THEN RAISE EXCEPTION 'test-only failure'; END IF;
      RETURN NEW; END $$`);
    await pool.query(
      'CREATE TRIGGER issue26_failure BEFORE UPDATE ON photos FOR EACH ROW EXECUTE FUNCTION issue26_fail()',
    );
    try {
      const response = await trash(photos.map((photo) => photo.id));
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain('test-only');
      expect((await pool.query('SELECT deleted FROM photos')).rows).toEqual([
        { deleted: false },
        { deleted: false },
      ]);
    } finally {
      await pool.query('DROP TRIGGER issue26_failure ON photos');
      await pool.query('DROP FUNCTION issue26_fail()');
    }
    expect((await trash(photos.map((photo) => photo.id))).status).toBe(204);
  });
  it('serializes reversed overlapping batches and membership edits without losing unrelated data', async () => {
    const a = await add(),
      b = await add();
    await album('A');
    await album('B');
    await membership(a.id, 'A');
    const responses = await Promise.all([
      trash([a.id, b.id]),
      trash([b.id, a.id], users[1]),
      membership(a.id, 'B'),
      membership(a.id, 'A', 'DELETE'),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      204, 204, 204, 204,
    ]);
    expect(await (await request('/api/photos')).json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: a.id, deleted: true, albums: ['B'] }),
        expect.objectContaining({ id: b.id, deleted: true, albums: [] }),
      ]),
    );
  });
  it('waits for concurrent restore/deletion/album additions, then applies trash after their commit', async () => {
    const a = await add(),
      b = await add();
    await album('A');
    // Each operation commits while the batch waits on the same photo row.
    for (const preceding of ['restore', 'delete', 'album'] as const) {
      const lock = await pool.connect();
      let pending: Promise<Response> | undefined;
      try {
        await lock.query('BEGIN');
        await lock.query('UPDATE photos SET deleted=$2 WHERE id=$1', [
          a.id,
          preceding === 'delete',
        ]);
        if (preceding === 'album')
          await lock.query(
            "INSERT INTO photo_albums VALUES($1,'A') ON CONFLICT DO NOTHING",
            [a.id],
          );
        pending = trash([a.id, b.id]);
        await expect
          .poll(async () => {
            const waiting = await pool.query(
              `SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM photos WHERE id=ANY%'`,
            );
            return waiting.rows[0]?.count as number;
          })
          .toBeGreaterThan(0);
        await lock.query('COMMIT');
        expect((await pending).status).toBe(204);
      } finally {
        await lock.query('ROLLBACK');
        lock.release();
        await pending;
      }
      expect((await pool.query('SELECT deleted FROM photos')).rows).toEqual([
        { deleted: true },
        { deleted: true },
      ]);
    }
    expect((await bulk([a.id, b.id], 'A')).status).toBe(409);
    expect(
      (await request(`/api/photos/${a.id}`, 'PATCH', '{"deleted":false}'))
        .status,
    ).toBe(200);
    expect(
      (await pool.query('SELECT deleted FROM photos WHERE id=$1', [a.id])).rows,
    ).toEqual([{ deleted: false }]);
    expect(
      (
        await pool.query(
          'SELECT album_name FROM photo_albums WHERE photo_id=$1',
          [a.id],
        )
      ).rows,
    ).toEqual([{ album_name: 'A' }]);
  });
});

it('concurrent bulk addition and trash observe a serialized all-or-nothing result', async () => {
  const a = await add(),
    b = await add();
  await album('A');
  await album('B');
  await membership(a.id, 'B');
  for (const trashFirst of [false, true]) {
    for (const photo of [a, b]) {
      await request(`/api/photos/${photo.id}`, 'PATCH', '{"deleted":false}');
      await membership(photo.id, 'A', 'DELETE');
    }
    const responses = await Promise.all(
      trashFirst
        ? [trash([a.id, b.id]), bulk([b.id, a.id], 'A')]
        : [bulk([a.id, b.id], 'A'), trash([b.id, a.id])],
    );
    const moved = responses[trashFirst ? 0 : 1];
    const added = responses[trashFirst ? 1 : 0];
    if (!moved || !added) throw new Error('Missing response');
    expect(moved.status).toBe(204);
    expect([204, 409]).toContain(added.status);
    expect(
      (await pool.query("SELECT * FROM photo_albums WHERE album_name='A'"))
        .rowCount,
    ).toBe(added.status === 204 ? 2 : 0);
    expect(
      (await pool.query("SELECT * FROM photo_albums WHERE album_name='B'"))
        .rowCount,
    ).toBe(1);
    expect((await pool.query('SELECT deleted FROM photos')).rows).toEqual([
      { deleted: true },
      { deleted: true },
    ]);
  }
});
