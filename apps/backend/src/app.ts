import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import type { Pool } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { imageProcessor } from './image-processor.js';
import { ImageError, imageMessages } from './image-core.js';

type Row = {
  id: string;
  filename: string;
  created_at: Date;
  favorite: boolean;
  deleted: boolean;
  albums?: string[];
  media_type: string;
};
type Settings = {
  pool: Pool;
  dataDir: string;
  origin: string;
  users: string[];
  devUser?: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const memberships = `(SELECT COALESCE(array_agg(album_name ORDER BY album_name), ARRAY[]::text[]) FROM photo_albums WHERE photo_id=p.id)`;
function view(row: Row) {
  return {
    id: row.id,
    name: row.filename,
    src: `/api/photos/${row.id}/thumbnail`,
    originalUrl: `/api/photos/${row.id}/original`,
    date: row.created_at.toISOString().slice(0, 10),
    createdAt: row.created_at.toISOString(),
    location: '撮影日時・場所は未表示',
    favorite: row.favorite,
    deleted: row.deleted,
    albums: row.albums ?? [],
  };
}
function fail(
  status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 503,
  message: string,
): never {
  throw new HTTPException(status, { message });
}
export function createApp(settings: Settings) {
  if (
    settings.users.length !== 2 ||
    new Set(settings.users).size !== 2 ||
    settings.users.some((u) => !u.trim())
  )
    throw new Error('ALLOWED_USERSには異なる2人を設定してください');
  if (settings.devUser && !settings.users.includes(settings.devUser))
    throw new Error('DEV_USER must be allowed');
  const app = new Hono<{ Variables: { user: string } }>();
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    if (c.req.header('Tailscale-Funnel-Request'))
      fail(403, '公開経路からは利用できません');
    const user = settings.devUser ?? c.req.header('Tailscale-User-Login');
    if (!user)
      fail(401, '利用者を確認できません。Tailscale経由で接続してください。');
    if (!settings.users.includes(user)) fail(403, '利用が許可されていません');
    c.set('user', user);
    if (
      !['GET', 'HEAD'].includes(c.req.method) &&
      (c.req.header('Origin') !== settings.origin ||
        c.req.header('X-Photo-Request') !== '1')
    )
      fail(403, '送信元を確認できません');
    await next();
  });
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: 51 * 1024 * 1024,
      onError: () => {
        fail(413, '1枚50MB以下の画像を選んでください');
      },
    }),
  );
  app.onError((error, c) => {
    const status = error instanceof HTTPException ? error.status : 500;
    // Do not expose SQL, paths, identities, or parser diagnostics.
    return c.json(
      {
        code: `HTTP_${status}`,
        message:
          status === 500
            ? '保存先に接続できません。もう一度お試しください。'
            : error.message,
        requestId: randomUUID(),
      },
      status,
    );
  });
  app.get('/api/me', (c) => c.json({ displayName: c.get('user') }));
  app.get('/api/albums', async (c) => {
    const result = await settings.pool.query<{ name: string }>(
      'SELECT name FROM albums ORDER BY name',
    );
    return c.json(result.rows.map((r) => r.name));
  });
  app.delete('/api/albums', async (c) => {
    const body = await json(c.req.raw);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).join() !== 'name' ||
      !('name' in body) ||
      typeof body.name !== 'string' ||
      !body.name.length ||
      Array.from(body.name).length > 100 ||
      body.name.includes('\0')
    )
      fail(400, 'アルバム名が不正です');
    const name = body.name;
    const client = await settings.pool.connect();
    try {
      await client.query('BEGIN');
      // Membership mutations hold KEY SHARE on this same album row. Take the
      // exclusive lock before removing memberships, without locking photos:
      // an edit already in progress finishes first; a later edit sees 404.
      const album = await client.query(
        'SELECT name FROM albums WHERE name=$1 FOR UPDATE',
        [name],
      );
      if (album.rowCount) {
        await client.query('DELETE FROM photo_albums WHERE album_name=$1', [
          name,
        ]);
        await client.query('DELETE FROM albums WHERE name=$1', [name]);
      }
      await client.query('COMMIT');
      return c.body(null, 204);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  app.post('/api/albums', async (c) => {
    const body: unknown = await json(c.req.raw);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).join() !== 'name' ||
      !('name' in body) ||
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.trim().length > 100
    )
      fail(400, 'アルバム名は1〜100文字で入力してください');
    const name = body.name.trim();
    const result = await settings.pool.query(
      'INSERT INTO albums(name) VALUES($1) ON CONFLICT DO NOTHING RETURNING name',
      [name],
    );
    if (!result.rowCount) fail(409, '同じ名前のアルバムがあります');
    return c.json(name);
  });
  app.get('/api/photos', async (c) => {
    const result = await settings.pool.query<Row>(
      `SELECT p.*, ${memberships} AS albums FROM photos p ORDER BY created_at DESC, id DESC`,
    );
    return c.json(result.rows.map(view));
  });
  app.post('/api/photos', async (c) => {
    let form: FormData;
    try {
      form = await c.req.raw.formData();
    } catch {
      fail(400, 'ファイルを選んでください');
    }
    const file = form.get('file');
    if (!(file instanceof File) || [...form.keys()].length !== 1)
      fail(400, '写真を1枚選んでください');
    if (!file.size) fail(422, '空のファイルです');
    if (file.size > 50 * 1024 * 1024)
      fail(413, '1枚50MB以下の画像を選んでください');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      fail(415, imageMessages.unsupported);
    const bytes = Buffer.from(await file.arrayBuffer());
    let processed;
    try {
      processed = await imageProcessor.process(bytes, file.type);
    } catch (error) {
      if (error instanceof ImageError) fail(error.status, error.message);
      fail(503, imageMessages.busy);
    }
    const { thumbnail, metadata } = processed;
    const id = randomUUID();
    const filename =
      Array.from(file.name, (ch) =>
        ch.charCodeAt(0) < 32 ||
        ch.charCodeAt(0) === 127 ||
        ch === '/' ||
        ch === '\\'
          ? '_'
          : ch,
      )
        .join('')
        .slice(0, 255) || 'photo';
    await mkdir(settings.dataDir, { recursive: true, mode: 0o700 });
    const original = join(settings.dataDir, `${id}.original`),
      thumb = join(settings.dataDir, `${id}.jpg`);
    // Retain private orphan files if DB acknowledgement is lost; never remove a possibly committed original.
    await writeFile(original, bytes, {
      flag: 'wx',
      mode: 0o600,
      flush: true,
    });
    await writeFile(thumb, thumbnail, {
      flag: 'wx',
      mode: 0o600,
      flush: true,
    });
    const result = await settings.pool.query<Row>(
      'INSERT INTO photos(id,filename,media_type,size_bytes,sha256,uploaded_by,metadata) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [
        id,
        filename,
        file.type,
        file.size,
        createHash('sha256').update(bytes).digest('hex'),
        c.get('user'),
        metadata,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Missing saved row');
    return c.json(view(row));
  });
  app.put('/api/photos/trash', async (c) => {
    const body = await json(c.req.raw);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      fail(400, '移動内容が不正です');
    const b = body as Record<string, unknown>;
    if (
      Object.keys(b).join() !== 'photoIds' ||
      !Array.isArray(b.photoIds) ||
      b.photoIds.length < 1 ||
      b.photoIds.length > 100 ||
      b.photoIds.some((id) => typeof id !== 'string' || !uuid.test(id))
    )
      fail(400, '写真は1〜100枚を指定してください');
    const ids = (b.photoIds as string[]).map((id) => id.toLowerCase()).sort();
    if (new Set(ids).size !== ids.length) fail(400, '写真IDが重複しています');
    const client = await settings.pool.connect();
    try {
      await client.query('BEGIN');
      // Share the ordered photo locks with album mutations. Never update part
      // of a batch before all targets have been found and locked.
      const photos = await client.query(
        'SELECT id FROM photos WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
        [ids],
      );
      if (photos.rowCount !== ids.length)
        fail(404, '写真が存在しません。再取得して選び直してください');
      await client.query(
        'UPDATE photos SET deleted=true WHERE id=ANY($1::uuid[]) AND NOT deleted',
        [ids],
      );
      await client.query('COMMIT');
      return c.body(null, 204);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  app.put('/api/photos/albums', async (c) => {
    const body = await json(c.req.raw);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      fail(400, '追加内容が不正です');
    const b = body as Record<string, unknown>;
    if (
      Object.keys(b).length !== 2 ||
      Object.keys(b).some((key) => !['photoIds', 'name'].includes(key)) ||
      !Array.isArray(b.photoIds) ||
      b.photoIds.length < 1 ||
      b.photoIds.length > 100 ||
      b.photoIds.some((id) => typeof id !== 'string' || !uuid.test(id)) ||
      typeof b.name !== 'string' ||
      !b.name.length ||
      Array.from(b.name).length > 100
    )
      fail(400, '写真は1〜100枚、追加先は既存のアルバムを指定してください');
    const ids = (b.photoIds as string[]).map((id) => id.toLowerCase()).sort();
    if (new Set(ids).size !== ids.length) fail(400, '写真IDが重複しています');
    const client = await settings.pool.connect();
    try {
      await client.query('BEGIN');
      // All mutation paths lock the same photo rows. Ordered locking also
      // prevents two overlapping batches in opposite input orders deadlocking.
      const photos = await client.query<{ id: string; deleted: boolean }>(
        'SELECT id,deleted FROM photos WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
        [ids],
      );
      if (photos.rowCount !== ids.length) fail(404, '写真が見つかりません');
      const album = await client.query(
        'SELECT name FROM albums WHERE name=$1 FOR KEY SHARE',
        [b.name],
      );
      if (!album.rowCount) fail(404, 'アルバムが見つかりません');
      // Missing entities take precedence over trash conflicts.
      if (photos.rows.some((photo) => photo.deleted))
        fail(409, 'ゴミ箱内の写真が含まれています。選択を見直してください');
      await client.query(
        'INSERT INTO photo_albums(photo_id,album_name) SELECT id,$2 FROM unnest($1::uuid[]) AS id ON CONFLICT DO NOTHING',
        [ids, b.name],
      );
      await client.query('COMMIT');
      return c.body(null, 204);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  app.patch('/api/photos/:id', async (c) => {
    const id = c.req.param('id');
    if (!uuid.test(id)) fail(400, '写真IDが不正です');
    const body: unknown = await json(c.req.raw);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      fail(400, '変更内容が不正です');
    const b = body as Record<string, unknown>;
    if (
      !Object.keys(b).length ||
      Object.keys(b).some((k) => !['favorite', 'deleted'].includes(k)) ||
      ('favorite' in b && typeof b.favorite !== 'boolean') ||
      ('deleted' in b && typeof b.deleted !== 'boolean')
    )
      fail(400, '変更内容が不正です');
    const result = await settings.pool.query<Row>(
      `UPDATE photos p SET favorite=COALESCE($2,favorite), deleted=COALESCE($3,deleted) WHERE id=$1 RETURNING p.*, ${memberships} AS albums`,
      [id, b.favorite ?? null, b.deleted ?? null],
    );
    const row = result.rows[0];
    if (!row) fail(404, '写真が見つかりません');
    return c.json(view(row));
  });
  app.on(['PUT', 'DELETE'], '/api/photos/:id/albums', async (c) => {
    const id = c.req.param('id');
    if (!uuid.test(id)) fail(400, '写真IDが不正です');
    const body = await json(c.req.raw);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).join() !== 'name' ||
      !('name' in body) ||
      typeof body.name !== 'string' ||
      !body.name.length ||
      Array.from(body.name).length > 100
    )
      fail(400, 'アルバム名が不正です');
    const name = body.name;
    const client = await settings.pool.connect();
    try {
      await client.query('BEGIN');
      const photo = await client.query(
        'SELECT id FROM photos WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!photo.rowCount) fail(404, '写真が見つかりません');
      const album = await client.query(
        'SELECT name FROM albums WHERE name=$1 FOR KEY SHARE',
        [name],
      );
      if (!album.rowCount) fail(404, 'アルバムが見つかりません');
      if (c.req.method === 'PUT')
        await client.query(
          'INSERT INTO photo_albums(photo_id,album_name) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [id, name],
        );
      else
        await client.query(
          'DELETE FROM photo_albums WHERE photo_id=$1 AND album_name=$2',
          [id, name],
        );
      await client.query('COMMIT');
      return c.body(null, 204);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  for (const variant of ['original', 'thumbnail'] as const)
    app.get(`/api/photos/:id/${variant}`, async (c) => {
      const id = c.req.param('id');
      if (!uuid.test(id)) fail(400, '写真IDが不正です');
      const disposition = c.req.query('disposition') ?? 'attachment';
      if (
        variant === 'original' &&
        !['attachment', 'inline'].includes(disposition)
      )
        fail(400, '表示方法が不正です');
      const result = await settings.pool.query<Row>(
        'SELECT * FROM photos WHERE id=$1',
        [id],
      );
      const row = result.rows[0];
      if (!row) fail(404, '写真が見つかりません');
      const bytes = await readFile(
        join(
          settings.dataDir,
          `${id}.${variant === 'original' ? 'original' : 'jpg'}`,
        ),
      );
      c.header(
        'Content-Type',
        variant === 'original' ? row.media_type : 'image/jpeg',
      );
      if (variant === 'original')
        c.header(
          'Content-Disposition',
          `${disposition}; filename="photo"; filename*=UTF-8''${encodeURIComponent(row.filename).replace(/['()*]/g, (ch) => '%' + ch.charCodeAt(0).toString(16))}`,
        );
      return c.body(bytes);
    });
  return app;
}
async function json(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    fail(400, 'JSONが不正です');
  }
}
