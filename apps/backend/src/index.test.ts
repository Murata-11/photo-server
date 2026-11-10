import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  serve: vi.fn(() => ({ close: vi.fn((done: () => void) => done()) })),
  end: vi.fn(),
}));
vi.mock('@hono/node-server', () => ({ serve: mocks.serve }));
vi.mock('./store.js', () => ({ database: () => ({ end: mocks.end }) }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});
it('refuses incomplete or insecure production configuration', async () => {
  vi.stubEnv('DATABASE_URL', '');
  await expect(import('./index.js')).rejects.toThrow('DATABASE_URL');
  vi.resetModules();
  vi.stubEnv('DATABASE_URL', 'postgresql://fixture');
  vi.stubEnv('APP_ORIGIN', 'http://example.test');
  vi.stubEnv('ALLOWED_USERS', 'a,b');
  vi.stubEnv('DEV_USER', '');
  await expect(import('./index.js')).rejects.toThrow('HTTPS');
  vi.resetModules();
  vi.stubEnv('DEV_USER', 'a');
  await expect(import('./index.js')).rejects.toThrow('ローカル');
});
it('binds production to loopback and closes database on shutdown', async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://fixture');
  vi.stubEnv('APP_ORIGIN', 'https://example.test');
  vi.stubEnv('ALLOWED_USERS', 'a,b');
  vi.stubEnv('DEV_USER', '');
  const listeners: Array<() => void> = [];
  const spy = vi.spyOn(process, 'on').mockImplementation(((
    event: string,
    callback: () => void,
  ) => {
    if (event === 'SIGTERM' || event === 'SIGINT') listeners.push(callback);
    return process;
  }) as typeof process.on);
  try {
    await import('./index.js');
    expect(mocks.serve).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: '127.0.0.1', port: 3000 }),
    );
    for (const listener of listeners) listener();
    expect(mocks.end).toHaveBeenCalledTimes(2);
  } finally {
    spy.mockRestore();
  }
});
