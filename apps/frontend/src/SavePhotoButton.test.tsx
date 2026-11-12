// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SavePhotoButton } from './SavePhotoButton';
const photo = {
  name: 'original.jpg',
  originalUrl: '/api/photos/test/original',
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup() {
  const share = vi.fn().mockResolvedValue(undefined);
  const canShare = vi.fn().mockReturnValue(true);
  vi.stubGlobal('navigator', { ...navigator, share, canShare });
  const bytes = new Uint8Array([255, 216, 255, 1, 2]);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob([bytes], { type: 'image/jpeg' }),
    }),
  );
  return { share, canShare, bytes };
}
it('非対応環境では元画像のダウンロードを維持する', () => {
  vi.stubGlobal('navigator', { share: undefined, canShare: undefined });
  render(<SavePhotoButton photo={photo} />);
  const link = screen.getByRole('link', { name: 'ダウンロード' });
  expect(link.getAttribute('href')).toBe(photo.originalUrl);
  expect(link.getAttribute('download')).toBe(photo.name);
});
it('準備後のタップで元バイト・MIME・名前を保ったFileを共有する', async () => {
  const { share, canShare, bytes } = setup();
  const user = userEvent.setup();
  render(<SavePhotoButton photo={photo} />);
  await user.click(screen.getByRole('button', { name: '写真に保存' }));
  await screen.findByRole('button', { name: '共有画面を開く' });
  expect(share).not.toHaveBeenCalled();
  const file = canShare.mock.calls[0]?.[0].files[0] as File;
  expect(file.name).toBe(photo.name);
  expect(file.type).toBe('image/jpeg');
  const content = await new Promise<ArrayBuffer>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(file);
  });
  expect(new Uint8Array(content)).toEqual(bytes);
  await user.click(screen.getByRole('button', { name: '共有画面を開く' }));
  expect(share).toHaveBeenCalledWith({ files: [file] });
  expect(screen.getByRole('status').textContent).toContain('保存結果をご確認');
});
it('取得失敗は再試行でき、ファイル非対応はダウンロードへ案内する', async () => {
  const { canShare } = setup();
  vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
  const user = userEvent.setup();
  render(<SavePhotoButton photo={photo} />);
  await user.click(screen.getByRole('button', { name: '写真に保存' }));
  await screen.findByRole('button', { name: '再試行' });
  canShare.mockReturnValue(false);
  await user.click(screen.getByRole('button', { name: '再試行' }));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain(
      'この写真は共有できません',
    ),
  );
  expect(
    screen.getByRole('link', { name: 'ダウンロード' }).getAttribute('href'),
  ).toBe(photo.originalUrl);
});
it('共有のキャンセル・失敗後にも同じファイルで再試行できる', async () => {
  const { share } = setup();
  share
    .mockRejectedValueOnce(new DOMException('cancel', 'AbortError'))
    .mockRejectedValueOnce(new Error('denied'));
  const user = userEvent.setup();
  render(<SavePhotoButton photo={photo} />);
  await user.click(screen.getByRole('button', { name: '写真に保存' }));
  await user.click(
    await screen.findByRole('button', { name: '共有画面を開く' }),
  );
  expect(screen.getByRole('status').textContent).toContain('キャンセル');
  await user.click(screen.getByRole('button', { name: '共有画面を開く' }));
  expect(screen.getByRole('status').textContent).toContain('開けませんでした');
  await user.click(screen.getByRole('button', { name: '共有画面を開く' }));
  expect(share).toHaveBeenCalledTimes(3);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('準備中に閉じると取得を中断する', async () => {
  setup();
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
  const user = userEvent.setup();
  render(<SavePhotoButton photo={photo} />);
  await user.click(screen.getByRole('button', { name: '写真に保存' }));
  const signal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal;
  await user.click(screen.getByRole('button', { name: '閉じる' }));
  expect(signal?.aborted).toBe(true);
});
