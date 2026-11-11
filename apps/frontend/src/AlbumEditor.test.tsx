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
it('saves immediately and preserves the other memberships', async () => {
  const user = setup();
  await user.click(screen.getByRole('checkbox', { name: '新しい所属' }));
  await waitFor(() =>
    expect(api.addAlbum).toHaveBeenCalledExactlyOnceWith('1', '新しい所属'),
  );
  expect(api.removeAlbum).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.queryByRole('searchbox')).toBeNull();
  await user.click(screen.getByRole('checkbox', { name: '元の所属' }));
  await waitFor(() =>
    expect(api.removeAlbum).toHaveBeenCalledExactlyOnceWith('1', '元の所属'),
  );
});
it('rolls back only a failed row and retries its intended operation', async () => {
  vi.mocked(api.removeAlbum).mockRejectedValueOnce(new Error('offline'));
  const user = setup();
  await user.click(screen.getByRole('checkbox', { name: '元の所属' }));
  await screen.findByRole('alert');
  expect(
    (screen.getByRole('checkbox', { name: '元の所属' }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  await user.click(screen.getByRole('checkbox', { name: '新しい所属' }));
  await user.click(screen.getByRole('button', { name: '元の所属を再試行' }));
  await waitFor(() => expect(api.removeAlbum).toHaveBeenCalledTimes(2));
  expect(api.addAlbum).toHaveBeenCalledTimes(1);
});
it('retries refresh without resending successful writes', async () => {
  vi.mocked(api.list).mockRejectedValueOnce(new Error('offline'));
  const user = setup();
  await user.click(screen.getByRole('checkbox', { name: '新しい所属' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: '最新情報を再取得' }));
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  expect(api.addAlbum).toHaveBeenCalledTimes(1);
});
it('disables only the pending row and allows another membership to save', async () => {
  let finish: (() => void) | undefined;
  vi.mocked(api.removeAlbum).mockImplementation(
    () =>
      new Promise<undefined>((resolve) => {
        finish = () => resolve(undefined);
      }),
  );
  const user = setup();
  await user.click(screen.getByRole('checkbox', { name: '元の所属' }));
  expect(
    (screen.getByRole('checkbox', { name: '元の所属' }) as HTMLInputElement)
      .disabled,
  ).toBe(true);
  await user.click(screen.getByRole('checkbox', { name: '新しい所属' }));
  expect(api.addAlbum).toHaveBeenCalledTimes(1);
  expect(api.list).not.toHaveBeenCalled();
  finish?.();
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1));
});
