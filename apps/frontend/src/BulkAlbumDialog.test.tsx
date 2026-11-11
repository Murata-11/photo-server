// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkAlbumDialog } from './BulkAlbumDialog';
import { api } from './lib/api';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('保存後の再取得失敗では追加を再送せず再取得だけ再試行する', async () => {
  const user = userEvent.setup();
  const add = vi.spyOn(api, 'addPhotosAlbum').mockResolvedValue(undefined);
  const reload = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(undefined);
  const saved = vi.fn(),
    close = vi.fn();
  render(
    <BulkAlbumDialog
      open
      onOpenChange={close}
      photoIds={['photo']}
      albums={['旅']}
      onSaved={saved}
      onReload={reload}
    />,
  );
  await user.selectOptions(screen.getByRole('combobox'), '旅');
  await user.click(screen.getByRole('button', { name: '追加' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('追加は完了'),
  );
  await user.click(screen.getByRole('button', { name: '再取得' }));
  await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  expect(add).toHaveBeenCalledTimes(1);
  expect(saved).toHaveBeenCalledTimes(1);
  expect(reload).toHaveBeenCalledTimes(2);
});
it('更新失敗は追加先と対象を維持し再送できる', async () => {
  const user = userEvent.setup();
  const add = vi
    .spyOn(api, 'addPhotosAlbum')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(undefined);
  const saved = vi.fn();
  render(
    <BulkAlbumDialog
      open
      onOpenChange={vi.fn()}
      photoIds={['photo']}
      albums={['旅']}
      onSaved={saved}
      onReload={vi.fn().mockResolvedValue(undefined)}
    />,
  );
  await user.selectOptions(screen.getByRole('combobox'), '旅');
  await user.click(screen.getByRole('button', { name: '追加' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('結果が不明'),
  );
  expect(saved).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '再試行' }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(add).toHaveBeenNthCalledWith(2, { photoIds: ['photo'], name: '旅' });
});
it('送信前のキャンセルはAPIを呼ばない', async () => {
  const user = userEvent.setup();
  const add = vi.spyOn(api, 'addPhotosAlbum');
  const close = vi.fn();
  render(
    <BulkAlbumDialog
      open
      onOpenChange={close}
      photoIds={['photo']}
      albums={['旅']}
      onSaved={vi.fn()}
      onReload={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'キャンセル' }));
  expect(close).toHaveBeenCalledWith(false);
  expect(add).not.toHaveBeenCalled();
});
