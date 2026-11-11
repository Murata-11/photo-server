import { Pool, type PoolClient } from 'pg';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export function database(connectionString: string) {
  return new Pool({ connectionString });
}
const versions = ['0001-initial.sql', '0002-multiple-albums.sql'];
// Never silently adopt an unrelated or partially modified legacy database.
async function validateLegacy(client: PoolClient) {
  const expected: Record<string, string> = {
    'albums.name': 'text:NO',
    'photos.id': 'uuid:NO',
    'photos.filename': 'text:NO',
    'photos.media_type': 'text:NO',
    'photos.size_bytes': 'bigint:NO',
    'photos.sha256': 'character:NO',
    'photos.uploaded_by': 'text:NO',
    'photos.created_at': 'timestamp with time zone:NO',
    'photos.favorite': 'boolean:NO',
    'photos.deleted': 'boolean:NO',
    'photos.album': 'text:YES',
    'photos.metadata': 'jsonb:NO',
  };
  const columns = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    "SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema=current_schema() AND table_name IN ('albums','photos')",
  );
  if (
    columns.rowCount !== Object.keys(expected).length ||
    columns.rows.some(
      (c) =>
        expected[`${c.table_name}.${c.column_name}`] !==
        `${c.data_type}:${c.is_nullable}`,
    )
  )
    throw new Error('Unexpected legacy database structure; migration stopped');
  const keys = await client.query<{ table_name: string; columns: string[] }>(
    `SELECT t.relname AS table_name, array_agg(a.attname::text ORDER BY u.n) AS columns
     FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
     JOIN pg_namespace s ON s.oid=t.relnamespace
     CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS u(attnum,n)
     JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=u.attnum
     WHERE s.nspname=current_schema() AND t.relname IN ('photos','albums') AND c.contype='p'
     GROUP BY t.relname`,
  );
  if (
    !keys.rows.some(
      (k) => k.table_name === 'photos' && k.columns.join() === 'id',
    ) ||
    !keys.rows.some(
      (k) => k.table_name === 'albums' && k.columns.join() === 'name',
    )
  )
    throw new Error('Unexpected legacy primary keys; migration stopped');
}
export async function migrate(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(210021)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query<{ version: number; checksum: string }>(
      'SELECT version,checksum FROM schema_migrations ORDER BY version',
    );
    if (
      applied.rows.some(
        (r, i) => r.version !== i + 1 || r.version > versions.length,
      )
    )
      throw new Error('Unsupported migration history');
    for (const [index, file] of versions.entries()) {
      const version = index + 1;
      const sql = await readFile(
        new URL(`./migrations/${file}`, import.meta.url),
        'utf8',
      );
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = applied.rows.find((r) => r.version === version);
      if (previous) {
        if (previous.checksum !== checksum)
          throw new Error('Migration checksum mismatch');
        continue;
      }
      if (version === 1) {
        const existing = await client.query<{ count: string }>(
          "SELECT count(*) FROM information_schema.tables WHERE table_schema=current_schema() AND table_name IN ('photos','albums')",
        );
        if (existing.rows[0]?.count === '0') await client.query(sql);
        await validateLegacy(client);
      } else {
        await validateLegacy(client);
        await client.query(sql);
      }
      await client.query(
        'INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)',
        [version, checksum],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
