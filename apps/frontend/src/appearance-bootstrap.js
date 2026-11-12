// This same source runs synchronously in <head> and is imported by the App.
// Keep it self-contained: it must apply the saved appearance before first paint.
(() => {
  const browser = globalThis.window ?? globalThis;
  if (browser.hiyoriAppearance) return;
  const key = 'hiyori.appearance';
  const root = browser.document.documentElement;
  const subscribers = new Set();
  const normalize = (value) =>
    value === 'light' || value === 'dark' ? value : 'system';
  let value = 'system';
  let storageUnavailable = false;
  let query;
  try {
    value = normalize(browser.localStorage.getItem(key));
  } catch {
    storageUnavailable = true;
  }
  try {
    query = browser.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    // An unavailable system preference falls back to light.
  }
  let snapshot;
  const surface = browser.document.createElement('style');
  surface.textContent =
    'html[data-appearance] body { background: inherit; color: inherit; }';
  browser.document.head.append(surface);
  function publish() {
    const resolved =
      value === 'system' ? (query?.matches ? 'dark' : 'light') : value;
    const background = resolved === 'dark' ? '#111113' : '#f8fafd';
    root.dataset.appearance = resolved;
    root.style.colorScheme = resolved;
    root.style.backgroundColor = background;
    root.style.color = resolved === 'dark' ? '#f2f2f4' : '#20232b';
    const meta = browser.document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = background;
    snapshot = { value, resolved, storageUnavailable };
    for (const subscriber of subscribers) subscriber();
  }
  browser.hiyoriAppearance = {
    getSnapshot: () => snapshot,
    subscribe: (subscriber) => {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    setValue: (next) => {
      value = normalize(next);
      try {
        browser.localStorage.setItem(key, value);
        storageUnavailable = false;
      } catch {
        storageUnavailable = true;
      }
      publish();
    },
  };
  if (query?.addEventListener) query.addEventListener('change', publish);
  else if (query?.addListener) query.addListener(publish);
  browser.addEventListener('storage', (event) => {
    if ((event.key !== key && event.key !== null) || storageUnavailable) return;
    try {
      if (event.storageArea !== browser.localStorage) return;
      value = normalize(browser.localStorage.getItem(key));
    } catch {
      storageUnavailable = true;
    }
    publish();
  });
  publish();
})();
