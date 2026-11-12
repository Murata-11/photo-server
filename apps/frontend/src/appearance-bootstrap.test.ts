// @vitest-environment jsdom
import source from './appearance-bootstrap.js?raw';
import { beforeEach, expect, it, vi } from 'vitest';
function setup({
  stored = null,
  dark = false,
  readFails = false,
  writeFails = false,
  media = true,
  legacy = false,
}: {
  stored?: string | null;
  dark?: boolean;
  readFails?: boolean;
  writeFails?: boolean;
  media?: boolean;
  legacy?: boolean;
} = {}) {
  const events: Record<string, (event: object) => void> = {};
  const query = {
    matches: dark,
    addEventListener: vi.fn((_name: string, callback: () => void) => {
      events.media = callback;
    }),
    addListener: vi.fn((callback: () => void) => {
      events.media = callback;
    }),
  };
  if (legacy) Object.assign(query, { addEventListener: undefined });
  const storage = {
    getItem: vi.fn(() => {
      if (readFails) throw new Error('Denied');
      return stored;
    }),
    setItem: vi.fn((_key: string, value: string) => {
      if (writeFails) throw new Error('Quota');
      stored = value;
    }),
  };
  const runtime = {
    document,
    localStorage: storage,
    matchMedia: media ? vi.fn(() => query) : undefined,
    addEventListener: (name: string, callback: (event: object) => void) => {
      events[name] = callback;
    },
    hiyoriAppearance: undefined as Window['hiyoriAppearance'] | undefined,
  };
  const initialize = () => new Function('globalThis', source)(runtime);
  initialize();
  const controller = runtime.hiyoriAppearance;
  if (!controller) throw new Error('Not initialized');
  return {
    controller,
    storage,
    query,
    runtime,
    initialize,
    changeSystem(next: boolean) {
      query.matches = next;
      events.media?.({});
    },
    changeStorage(
      next: string | null,
      eventKey: string | null = 'hiyori.appearance',
      area: unknown = storage,
    ) {
      stored = next;
      events.storage?.({ key: eventKey, storageArea: area });
    },
  };
}
beforeEach(() => {
  document.head.innerHTML = '<meta name="theme-color" content="#f8fafd">';
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-appearance');
});
it('initializes the saved choice before the app, and repeated initialization is idempotent', () => {
  const { controller, initialize, runtime } = setup({ stored: 'dark' });
  expect(controller.getSnapshot()).toEqual({
    value: 'dark',
    resolved: 'dark',
    storageUnavailable: false,
  });
  expect(document.documentElement.dataset.appearance).toBe('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(document.querySelector('meta')?.content).toBe('#111113');
  initialize();
  expect(runtime.hiyoriAppearance).toBe(controller);
  expect(document.querySelectorAll('style')).toHaveLength(1);
});
it('follows OS changes only in system mode and reevaluates the latest preference on return', () => {
  const { controller, changeSystem, storage } = setup();
  const notify = vi.fn();
  const unsubscribe = controller.subscribe(notify);
  changeSystem(true);
  expect(controller.getSnapshot().resolved).toBe('dark');
  controller.setValue('light');
  expect(storage.setItem).toHaveBeenLastCalledWith(
    'hiyori.appearance',
    'light',
  );
  changeSystem(false);
  changeSystem(true);
  expect(controller.getSnapshot().resolved).toBe('light');
  controller.setValue('system');
  expect(controller.getSnapshot().resolved).toBe('dark');
  unsubscribe();
  notify.mockClear();
  changeSystem(false);
  expect(notify).not.toHaveBeenCalled();
});
it('accepts persisted choices and falls back for missing or invalid values and unavailable media queries', () => {
  for (const stored of [null, 'broken', 'system']) {
    expect(
      setup({ stored, dark: true }).controller.getSnapshot().resolved,
    ).toBe('dark');
  }
  expect(
    setup({ stored: 'light', dark: true }).controller.getSnapshot().resolved,
  ).toBe('light');
  expect(setup({ media: false }).controller.getSnapshot().resolved).toBe(
    'light',
  );
  const legacy = setup({ legacy: true });
  legacy.changeSystem(true);
  expect(legacy.controller.getSnapshot().resolved).toBe('dark');
});
it('keeps the in-memory selection when storage cannot be read or written', () => {
  for (const options of [
    { readFails: true, writeFails: true },
    { writeFails: true },
  ]) {
    const { controller, changeStorage } = setup(options);
    controller.setValue('dark');
    expect(controller.getSnapshot()).toEqual({
      value: 'dark',
      resolved: 'dark',
      storageUnavailable: true,
    });
    changeStorage('light');
    expect(controller.getSnapshot().value).toBe('dark');
  }
});
it('syncs local storage changes and clears but ignores session storage and unrelated keys', () => {
  const { controller, changeStorage } = setup({ dark: true });
  changeStorage('light');
  expect(controller.getSnapshot().resolved).toBe('light');
  changeStorage('dark', 'another-key');
  expect(controller.getSnapshot().resolved).toBe('light');
  changeStorage('dark', 'hiyori.appearance', {});
  expect(controller.getSnapshot().resolved).toBe('light');
  changeStorage('dark');
  expect(controller.getSnapshot().value).toBe('dark');
  changeStorage(null);
  expect(controller.getSnapshot().value).toBe('system');
  changeStorage('broken');
  expect(controller.getSnapshot().value).toBe('system');
  changeStorage('light');
  changeStorage(null, null);
  expect(controller.getSnapshot().value).toBe('system');
});
