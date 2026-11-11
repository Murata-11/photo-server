// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlbumEditor } from './AlbumEditor';
import { api } from './lib/api';
import { seed } from './mocks/data';
vi.mock('./lib/api', () => ({
  api: { addAlbum: vi.fn(), removeAlbum: vi.fn(), list: vi.fn() },
}));
const onClose = vi.fn(),
  onPhotos = vi.fn();
function setup() {
  const photo = seed[0];
  if (!photo) throw new Error('Missing fixture');
  render(
    <AlbumEditor
      photo={{ ...photo, albums: ['元の所属'] }}
      names={['元の所属', '新しい所属', '他の所属']}
      onPhotos={onPhotos}
      onClose={onClose}
    />,
  );
  return userEvent.setup();
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.list).mockResolvedValue([]);
});
afterEach(cleanup);
it('stages changes through search and sends only changed memberships', async () => {
  const user = setup();
  await user.click(screen.getByRole('checkbox', { name: '元の所属' }));
  await user.type(screen.getByRole('searchbox'), '新しい');
  await user.click(screen.getByRole('checkbox', { name: '新しい所属' }));
  expect(api.addAlbum).not.toHaveBeenCalled();
  await user.clear(screen.getByRole('searchbox'));
  await user.click(screen.getByRole('button', { name: '変更を保存' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(api.addAlbum).toHaveBeenCalledExactlyOnceWith('1', '新しい所属');
  expect(api.removeAlbum).toHaveBeenCalledExactlyOnceWith('1', '元の所属');
});
it('retries only failed changes after partial success', async () => {
  vi.mocked(api.removeAlbum).mockRejectedValueOnce(new Error('offline'));
  const user = setup();
  await user.click(screen.getByRole('checkbox', { name: '元の所属' }));
  await user.click(screen.getByRole('checkbox', { name: '新しい所属' }));
  await user.click(screen.getByRole('button', { name: '変更を保存' }));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    expect.stringContaining('1件保存済み。1件'),
  );
  expect(onClose).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '失敗分を再試行' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(api.addAlbum).toHaveBeenCalledTimes(1);
  expect(api.removeAlbum).toHaveBeenCalledTimes(2);
});
it('retries refresh without resending successful writes', async () => {
  vi.mocked(api.list).mockRejectedValueOnce(new Error('offline'));
  const user = setup();
  await user.click(screen.getByRole('checkbox', { name: '新しい所属' }));
  await user.click(screen.getByRole('button', { name: '変更を保存' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: '最新情報を再取得' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(api.addAlbum).toHaveBeenCalledTimes(1);
  expect(api.list).toHaveBeenCalledTimes(2);
});
it('confirms discard without making requests', async () => {
  const user = setup();
  await user.click(screen.getByRole('checkbox', { name: '元の所属' }));
  await user.click(screen.getByRole('button', { name: 'キャンセル' }));
  expect(screen.getByText('未保存の変更を破棄しますか？')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '変更を破棄' }));
  expect(onClose).toHaveBeenCalled();
  expect(api.removeAlbum).not.toHaveBeenCalled();
});
