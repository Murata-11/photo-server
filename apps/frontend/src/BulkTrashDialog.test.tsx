// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkTrashDialog } from './BulkTrashDialog';
import { api } from './lib/api';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const props = () => ({
  open: true,
  onOpenChange: vi.fn(),
  photoIds: ['one', 'two'],
  onSaved: vi.fn(),
  onReload: vi.fn().mockResolvedValue(undefined),
});
it('キャンセル・101枚超過では送信しない', async () => {
  const user = userEvent.setup();
  const send = vi.spyOn(api, 'trashPhotos');
  const options = props();
  const view = render(<BulkTrashDialog {...options} album="旅" />);
  expect(screen.getByText(/所属解除ではありません/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'キャンセル' }));
  expect(options.onOpenChange).toHaveBeenCalledWith(false);
  view.rerender(
    <BulkTrashDialog
      {...options}
      photoIds={Array.from({ length: 101 }, (_, i) => String(i))}
    />,
  );
  expect(screen.getByRole('alert').textContent).toContain('100枚まで');
  await user.click(screen.getByRole('button', { name: 'ゴミ箱に移動' }));
  expect(send).not.toHaveBeenCalled();
});
it('応答喪失では対象を維持し同じIDで再送する', async () => {
  const user = userEvent.setup();
  const send = vi
    .spyOn(api, 'trashPhotos')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(undefined);
  const options = props();
  render(<BulkTrashDialog {...options} />);
  await user.click(screen.getByRole('button', { name: 'ゴミ箱に移動' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    '結果が不明',
  );
  expect(options.onSaved).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '同じ対象を再試行' }));
  await waitFor(() => expect(options.onOpenChange).toHaveBeenCalledWith(false));
  expect(send).toHaveBeenNthCalledWith(2, { photoIds: ['one', 'two'] });
  expect(options.onSaved).toHaveBeenCalledWith(['one', 'two']);
});
it('保存後は再取得のみ再試行し二重移動しない', async () => {
  const user = userEvent.setup();
  const send = vi.spyOn(api, 'trashPhotos').mockResolvedValue(undefined);
  const options = props();
  options.onReload.mockRejectedValueOnce(new Error('offline'));
  const view = render(<BulkTrashDialog {...options} />);
  await user.click(screen.getByRole('button', { name: 'ゴミ箱に移動' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    '移動は完了',
  );
  view.rerender(<BulkTrashDialog {...options} photoIds={[]} />);
  await user.click(screen.getByRole('button', { name: '再取得' }));
  await waitFor(() => expect(options.onOpenChange).toHaveBeenCalledWith(false));
  expect(send).toHaveBeenCalledTimes(1);
  expect(options.onReload).toHaveBeenCalledTimes(2);
});
it('保存中は二重送信とEscape終了を防ぎ閉じた後は状態を戻す', async () => {
  const user = userEvent.setup();
  let finish: (() => void) | undefined;
  const send = vi.spyOn(api, 'trashPhotos').mockImplementation(
    () =>
      new Promise<undefined>((resolve) => {
        finish = () => resolve(undefined);
      }),
  );
  const options = props();
  const view = render(<BulkTrashDialog {...options} />);
  await user.click(screen.getByRole('button', { name: 'ゴミ箱に移動' }));
  await user.keyboard('{Escape}');
  expect(options.onOpenChange).not.toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toContain('移動しています');
  expect(send).toHaveBeenCalledTimes(1);
  finish?.();
  await waitFor(() => expect(options.onOpenChange).toHaveBeenCalledWith(false));
  view.rerender(<BulkTrashDialog {...options} open={false} />);
  view.rerender(<BulkTrashDialog {...options} />);
  expect(screen.getByRole('heading').textContent).toBe(
    '2枚をゴミ箱に移動しますか？',
  );
});
