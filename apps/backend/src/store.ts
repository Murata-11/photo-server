import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
export function database(connectionString: string) {
  return new Pool({ connectionString });
}
export async function migrate(pool: Pool) {
  await pool.query(
    await readFile(new URL('./schema.sql', import.meta.url), 'utf8'),
  );
}
