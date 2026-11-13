// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteAlbumDialog } from './DeleteAlbumDialog';
import { api } from './lib/api';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const props = () => ({
  name: '秋の小旅行',
  onClose: vi.fn(),
  onDeleted: vi.fn(),
  onReload: vi.fn().mockResolvedValue(undefined),
});

it('名前と写真保持・復元不可を示し、キャンセルでは送信しない', async () => {
  const user = userEvent.setup();
  const send = vi.spyOn(api, 'deleteAlbum');
  const options = props();
  render(<DeleteAlbumDialog {...options} />);
  expect(screen.getByText('「秋の小旅行」')).toBeTruthy();
  expect(screen.getByText(/写真は削除されません/).textContent).toContain(
    '復元できません',
  );
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'キャンセル' }),
    ),
  );
  await user.click(screen.getByRole('button', { name: 'キャンセル' }));
  expect(options.onClose).toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
it('削除成功後に一覧の再取得だけを再試行する', async () => {
  const user = userEvent.setup();
  const send = vi.spyOn(api, 'deleteAlbum').mockResolvedValue(undefined);
  const options = props();
  options.onReload.mockRejectedValueOnce(new Error('offline'));
  render(<DeleteAlbumDialog {...options} />);
  await user.click(screen.getByRole('button', { name: 'このアルバムを削除' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    '削除は完了',
  );
  expect(options.onDeleted).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: '再取得' }));
  await waitFor(() => expect(options.onClose).toHaveBeenCalled());
  expect(send).toHaveBeenCalledTimes(1);
  expect(options.onReload).toHaveBeenCalledTimes(2);
});
it('応答喪失後は状態を確認し、不存在なら削除を再送しない', async () => {
  const user = userEvent.setup();
  const send = vi
    .spyOn(api, 'deleteAlbum')
    .mockRejectedValue(new Error('offline'));
  const list = vi
    .spyOn(api, 'albums')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue([]);
  const options = props();
  render(<DeleteAlbumDialog {...options} />);
  await user.click(screen.getByRole('button', { name: 'このアルバムを削除' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    '結果が不明',
  );
  expect(options.onDeleted).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '削除結果を確認' }));
  expect((await screen.findByRole('alert')).textContent).toContain('offline');
  await user.click(screen.getByRole('button', { name: '削除結果を確認' }));
  await waitFor(() => expect(options.onClose).toHaveBeenCalled());
  expect(send).toHaveBeenCalledTimes(1);
  expect(list).toHaveBeenCalledTimes(2);
  expect(options.onDeleted).toHaveBeenCalledTimes(1);
});
it('同名アルバムがある場合は再確認を挟み自動で再削除しない', async () => {
  const user = userEvent.setup();
  const send = vi
    .spyOn(api, 'deleteAlbum')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(undefined);
  vi.spyOn(api, 'albums').mockResolvedValue(['秋の小旅行']);
  const options = props();
  render(<DeleteAlbumDialog {...options} />);
  await user.click(screen.getByRole('button', { name: 'このアルバムを削除' }));
  await user.click(
    await screen.findByRole('button', { name: '削除結果を確認' }),
  );
  expect((await screen.findByRole('alert')).textContent).toContain(
    '作り直された可能性',
  );
  expect(send).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'このアルバムを削除' }));
  await waitFor(() => expect(options.onClose).toHaveBeenCalled());
  expect(send).toHaveBeenNthCalledWith(2, '秋の小旅行');
});
it('削除処理中は重複実行・Escape・閉じる操作を防ぐ', async () => {
  const user = userEvent.setup();
  let finish: (() => void) | undefined;
  const send = vi.spyOn(api, 'deleteAlbum').mockImplementation(
    () =>
      new Promise<undefined>((resolve) => {
        finish = () => resolve(undefined);
      }),
  );
  const options = props();
  render(<DeleteAlbumDialog {...options} />);
  await user.click(screen.getByRole('button', { name: 'このアルバムを削除' }));
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'このアルバムを削除' }));
  expect(options.onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toContain('削除しています');
  expect(
    (screen.getByRole('button', { name: '閉じる' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(send).toHaveBeenCalledTimes(1);
  finish?.();
  await waitFor(() => expect(options.onClose).toHaveBeenCalled());
});
