import { fork } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImageError, imageMessages } from './image-core.js';

// One active native decoder and at most two waiting jobs across all app instances.
export class ImageProcessor {
  private active = false;
  private waiting: Array<() => void> = [];
  constructor(
    private readonly options: { worker?: string; timeoutMs?: number } = {},
  ) {}
  private async acquire() {
    if (this.active) {
      if (this.waiting.length >= 2)
        throw new ImageError(503, imageMessages.busy);
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active = true;
  }
  async process(bytes: Buffer, mime: string) {
    await this.acquire();
    let dir: string | undefined;
    try {
      dir = await mkdtemp(join(tmpdir(), 'photo-image-'));
      const input = join(dir, 'input'),
        output = join(dir, 'thumbnail.jpg'),
        result = join(dir, 'result.json');
      await writeFile(input, bytes, { mode: 0o600 });
      const source = import.meta.url.endsWith('.ts');
      const worker =
        this.options.worker ??
        fileURLToPath(
          new URL(
            source ? './image-worker.ts' : './image-worker.js',
            import.meta.url,
          ),
        );
      await new Promise<void>((resolve, reject) => {
        const child = fork(worker, [input, output, mime, result], {
          execArgv: source && !this.options.worker ? ['--import', 'tsx'] : [],
          detached: process.platform !== 'win32',
          stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        });
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          // Kill the process group, including any descendants.
          try {
            if (process.platform !== 'win32' && child.pid)
              process.kill(-child.pid, 'SIGKILL');
            else child.kill('SIGKILL');
          } catch {
            /* Process may already have exited. close still releases the slot. */
          }
        }, this.options.timeoutMs ?? 30_000);
        child.once('error', () => {
          clearTimeout(timer);
          reject(new ImageError(503, imageMessages.busy));
        });
        child.once('close', (code) => {
          clearTimeout(timer);
          if (timedOut || code !== 0)
            reject(new ImageError(503, imageMessages.busy));
          else resolve();
        });
      });
      const response = JSON.parse(await readFile(result, 'utf8')) as {
        status?: 415 | 422 | 503;
        message?: string;
        metadata?: Record<string, unknown>;
      };
      if (response.status)
        throw new ImageError(
          response.status,
          response.message ?? imageMessages.busy,
        );
      if (!response.metadata) throw new ImageError(503, imageMessages.busy);
      return { thumbnail: await readFile(output), metadata: response.metadata };
    } finally {
      try {
        if (dir) await rm(dir, { recursive: true, force: true });
      } finally {
        const next = this.waiting.shift();
        if (next) next();
        else this.active = false;
      }
    }
  }
}
export const imageProcessor = new ImageProcessor();
