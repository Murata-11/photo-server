import { beforeEach, afterEach, afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { database, migrate } from './store.js';
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL must be a disposable database');
const admin = database(url);
let pool: ReturnType<typeof database>;
let schema: string;
beforeEach(async () => {
  schema = 'issue21_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set('options', `-c search_path=${schema}`);
  pool = database(scoped.toString());
});
afterEach(async () => {
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
});
afterAll(() => admin.end());
async function legacy() {
  await pool.query(
    await readFile(
      new URL('./migrations/0001-initial.sql', import.meta.url),
      'utf8',
    ),
  );
  await pool.query("INSERT INTO albums(name) VALUES ('A'),('Empty')");
  for (const [i, album, deleted] of [
    [1, 'A', false],
    [2, 'A', true],
    [3, null, false],
  ] as const)
    await pool.query(
      `INSERT INTO photos(id,filename,media_type,size_bytes,sha256,uploaded_by,album,deleted,metadata) VALUES($1,'fixture.png','image/png',10,$2,'test',$3,$4,'{"private":"retained"}')`,
      [
        `00000000-0000-0000-0000-00000000000${i}`,
        'a'.repeat(64),
        album,
        deleted,
      ],
    );
}
it('initializes a new database and serializes simultaneous migrators', async () => {
  await Promise.all([migrate(pool), migrate(pool)]);
  expect(
    (await pool.query('SELECT version FROM schema_migrations ORDER BY version'))
      .rows,
  ).toEqual([{ version: 1 }, { version: 2 }]);
  await migrate(pool);
  expect(
    (
      await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='photos' AND column_name='album'",
      )
    ).rowCount,
  ).toBe(0);
});
it('adopts legacy data including trash and preserves empty albums and metadata', async () => {
  await legacy();
  const before = (
    await pool.query('SELECT id,deleted,metadata FROM photos ORDER BY id')
  ).rows;
  await migrate(pool);
  await migrate(pool);
  expect(
    (await pool.query('SELECT id,deleted,metadata FROM photos ORDER BY id'))
      .rows,
  ).toEqual(before);
  expect(
    (await pool.query('SELECT * FROM photo_albums ORDER BY photo_id')).rows,
  ).toEqual([
    { photo_id: '00000000-0000-0000-0000-000000000001', album_name: 'A' },
    { photo_id: '00000000-0000-0000-0000-000000000002', album_name: 'A' },
  ]);
  expect(
    (await pool.query('SELECT name FROM albums ORDER BY name')).rows,
  ).toEqual([{ name: 'A' }, { name: 'Empty' }]);
});
it('rolls back DDL, copied memberships and history on a late failure, then retries', async () => {
  await legacy();
  await pool.query(
    'CREATE VIEW dependent_legacy_view AS SELECT album FROM photos',
  );
  await expect(migrate(pool)).rejects.toThrow();
  expect(
    (await pool.query('SELECT album FROM photos WHERE deleted=true')).rows,
  ).toEqual([{ album: 'A' }]);
  expect(
    (
      await pool.query(
        "SELECT to_regclass('photo_albums') AS memberships,to_regclass('schema_migrations') AS history",
      )
    ).rows[0],
  ).toEqual({ memberships: null, history: null });
  await pool.query('DROP VIEW dependent_legacy_view');
  await migrate(pool);
  expect((await pool.query('SELECT * FROM photo_albums')).rowCount).toBe(2);
});
it('rejects unexpected legacy shape without changing data', async () => {
  await legacy();
  await pool.query('ALTER TABLE photos ADD COLUMN unexpected text');
  await expect(migrate(pool)).rejects.toThrow('Unexpected legacy');
  expect((await pool.query('SELECT * FROM photos')).rowCount).toBe(3);
});
it('rejects invalid legacy memberships instead of dropping them', async () => {
  await legacy();
  await pool.query('ALTER TABLE photos DROP CONSTRAINT photos_album_fkey');
  await pool.query("UPDATE photos SET album='orphan' WHERE deleted=true");
  await expect(migrate(pool)).rejects.toThrow('Invalid legacy');
  expect(
    (await pool.query('SELECT album FROM photos WHERE deleted=true')).rows,
  ).toEqual([{ album: 'orphan' }]);
});
it('rejects edited migration history and future versions', async () => {
  await migrate(pool);
  await pool.query(
    "UPDATE schema_migrations SET checksum='changed' WHERE version=1",
  );
  await expect(migrate(pool)).rejects.toThrow('checksum');
  await pool.query(
    "INSERT INTO schema_migrations(version,checksum) VALUES(3,'future')",
  );
  await expect(migrate(pool)).rejects.toThrow('Unsupported');
});

it('rejects a legacy table without its identity constraint', async () => {
  await legacy();
  await pool.query('ALTER TABLE photos DROP CONSTRAINT photos_pkey');
  await expect(migrate(pool)).rejects.toThrow('primary keys');
  expect((await pool.query('SELECT * FROM photos')).rowCount).toBe(3);
});

it('keeps the reference schema consistent with migrations', async () => {
  const snapshot = await readFile(
    new URL('./schema.sql', import.meta.url),
    'utf8',
  );
  await pool.query(snapshot);
  const columns = () =>
    pool.query(
      'SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema=current_schema() ORDER BY table_name,column_name',
    );
  const expected = (await columns()).rows;
  await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await pool.query(`CREATE SCHEMA ${schema}`);
  await migrate(pool);
  expect((await columns()).rows).toEqual(expected);
});
