// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
const render = vi.hoisted(() => vi.fn());
vi.mock('react-dom/client', () => ({
  default: { createRoot: () => ({ render }) },
}));
vi.mock('./App', () => ({ App: () => null }));
it('mounts the real app without activating a mock worker', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await import('./main');
  expect(render).toHaveBeenCalledOnce();
});
