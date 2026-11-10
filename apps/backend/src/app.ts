import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import type { Pool } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';
import { normalizeMetadata } from './metadata.js';

type Row = {
  id: string;
  filename: string;
  created_at: Date;
  favorite: boolean;
  deleted: boolean;
  album: string | null;
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
    album: row.album ?? '',
  };
}
function fail(
  status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422,
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
      maxSize: 11 * 1024 * 1024,
      onError: () => {
        fail(413, '1枚10MB以下の画像を選んでください');
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
      'SELECT * FROM photos ORDER BY created_at DESC, id DESC',
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
    if (file.size > 10 * 1024 * 1024)
      fail(413, '1枚10MB以下の画像を選んでください');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      fail(415, 'JPEG・PNG・WebPの画像を選んでください');
    const bytes = Buffer.from(await file.arrayBuffer());
    let thumbnail: Buffer;
    try {
      const image = sharp(bytes, {
        limitInputPixels: 40_000_000,
        failOn: 'warning',
      });
      const info = await image.metadata();
      const expected: Record<string, string> = {
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      };
      if (
        !info.format ||
        expected[info.format] !== file.type ||
        (info.pages ?? 1) > 1
      )
        fail(422, '画像の形式と内容が一致しないか、アニメーション画像です');
      thumbnail = await image
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      fail(422, '画像を読み込めません。破損していない画像を選んでください');
    }
    let metadata: Record<string, unknown>;
    try {
      const tags = await exifr.parse(bytes, {
        reviveValues: false,
        translateValues: false,
      });
      metadata = normalizeMetadata(tags);
    } catch {
      metadata = {
        timeStatus: 'failed',
        locationStatus: 'failed',
        parserVersion: 'exifr@7.1.3',
      };
    }
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
  app.patch('/api/photos/:id', async (c) => {
    const id = c.req.param('id');
    if (!uuid.test(id)) fail(400, '写真IDが不正です');
    const body: unknown = await json(c.req.raw);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      fail(400, '変更内容が不正です');
    const b = body as Record<string, unknown>;
    if (
      !Object.keys(b).length ||
      Object.keys(b).some(
        (k) => !['favorite', 'deleted', 'album'].includes(k),
      ) ||
      ('favorite' in b && typeof b.favorite !== 'boolean') ||
      ('deleted' in b && typeof b.deleted !== 'boolean') ||
      ('album' in b && (typeof b.album !== 'string' || b.album.length > 100))
    )
      fail(400, '変更内容が不正です');
    if (b.album) {
      const album = await settings.pool.query(
        'SELECT name FROM albums WHERE name=$1',
        [b.album],
      );
      if (!album.rowCount) fail(400, 'アルバムが見つかりません');
    }
    const result = await settings.pool.query<Row>(
      'UPDATE photos SET favorite=COALESCE($2,favorite), deleted=COALESCE($3,deleted), album=CASE WHEN $4::boolean THEN $5 ELSE album END WHERE id=$1 RETURNING *',
      [
        id,
        b.favorite ?? null,
        b.deleted ?? null,
        'album' in b,
        b.album || null,
      ],
    );
    const row = result.rows[0];
    if (!row) fail(404, '写真が見つかりません');
    return c.json(view(row));
  });
  for (const variant of ['original', 'thumbnail'] as const)
    app.get(`/api/photos/:id/${variant}`, async (c) => {
      const id = c.req.param('id');
      if (!uuid.test(id)) fail(400, '写真IDが不正です');
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
          `attachment; filename="photo"; filename*=UTF-8''${encodeURIComponent(row.filename).replace(/['()*]/g, (ch) => '%' + ch.charCodeAt(0).toString(16))}`,
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
