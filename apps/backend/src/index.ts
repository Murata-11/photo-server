import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { database, migrate } from './store.js';
const { DATABASE_URL, APP_ORIGIN, ALLOWED_USERS } = process.env;
const DEV_USER = process.env.DEV_USER || undefined;
if (!DATABASE_URL || !APP_ORIGIN || !ALLOWED_USERS)
  throw new Error('DATABASE_URL, APP_ORIGIN, ALLOWED_USERS が必要です');
const origin = new URL(APP_ORIGIN);
if (origin.origin !== APP_ORIGIN || (!DEV_USER && origin.protocol !== 'https:'))
  throw new Error('APP_ORIGINはHTTPSオリジンにしてください');
if (DEV_USER && !['localhost', '127.0.0.1'].includes(origin.hostname))
  throw new Error('DEV_USERはローカル開発専用です');
const pool = database(DATABASE_URL);
try {
  await migrate(pool);
} catch (error) {
  await pool.end();
  throw error;
}
const app = createApp({
  pool,
  dataDir: resolve(process.env.PHOTO_DATA_DIR ?? '../../work/photo-data'),
  origin: APP_ORIGIN,
  users: ALLOWED_USERS.split(',').map((u) => u.trim()),
  devUser: DEV_USER,
});
// Authentication also covers HTML and static assets. In Docker, publish only to host loopback.
app.use('*', serveStatic({ root: '../frontend/dist' }));
const server = serve({
  fetch: app.fetch,
  hostname: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 3000),
});
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    server.close(() => {
      void pool.end();
    });
  });
