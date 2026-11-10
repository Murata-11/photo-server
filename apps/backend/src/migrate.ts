import { database, migrate } from './store.js';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL が必要です');
const pool = database(url);
try {
  await migrate(pool);
} finally {
  await pool.end();
}
