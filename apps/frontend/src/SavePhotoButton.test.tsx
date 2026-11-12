// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SavePhotoButton } from './SavePhotoButton';
const photo = { name: '旅行.jpg', originalUrl: '/api/photos/test/original' };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('Web Share APIなしでもプレビューと元画像ダウンロードを選べる', async () => {
  vi.stubGlobal('navigator', { share: undefined, canShare: undefined });
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup();
  render(<SavePhotoButton photo={photo} />);
  await user.click(screen.getByRole('button', { name: '写真に保存' }));
  const preview = screen.getByRole('link', { name: '元画像をプレビュー' });
  const url = new URL(preview.getAttribute('href') ?? '');
  expect(url.pathname).toBe(photo.originalUrl);
  expect(url.searchParams.get('disposition')).toBe('inline');
  expect(preview.getAttribute('target')).toBe('_blank');
  expect(preview.hasAttribute('download')).toBe(false);
  expect(preview.getAttribute('rel')).toContain('noopener');
  const download = screen.getByRole('link', { name: 'ダウンロード' });
  expect(download.getAttribute('href')).toBe(photo.originalUrl);
  expect(download.getAttribute('download')).toBe(photo.name);
  expect(fetch).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('既存クエリを維持し、ダウンロード用指定をプレビュー用へ置換する', async () => {
  const user = userEvent.setup();
  render(
    <SavePhotoButton
      photo={{
        ...photo,
        originalUrl: photo.originalUrl + '?version=1&disposition=attachment',
      }}
    />,
  );
  await user.click(screen.getByRole('button', { name: '写真に保存' }));
  const url = new URL(
    screen
      .getByRole('link', { name: '元画像をプレビュー' })
      .getAttribute('href') ?? '',
  );
  expect(url.searchParams.get('version')).toBe('1');
  expect(url.searchParams.getAll('disposition')).toEqual(['inline']);
});
