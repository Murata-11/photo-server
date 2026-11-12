// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { api } from './lib/api';
import { seed, type Photo } from './mocks/data';
vi.mock('./lib/api', () => ({
  api: {
    list: vi.fn(),
    albums: vi.fn(),
    me: vi.fn(),
    create: vi.fn(),
    createAlbum: vi.fn(),
    update: vi.fn(),
    addAlbum: vi.fn(),
    addPhotosAlbum: vi.fn(),
    removeAlbum: vi.fn(),
    trashPhotos: vi.fn(),
  },
}));
let photos: Photo[];
beforeEach(() => {
  photos = structuredClone(seed);
  vi.mocked(api.list).mockImplementation(async () => structuredClone(photos));
  vi.mocked(api.albums).mockResolvedValue(['空のアルバム']);
  vi.mocked(api.me).mockResolvedValue({ displayName: 'テスト利用者' });
  vi.mocked(api.createAlbum).mockImplementation(async (name) => name);
  vi.mocked(api.update).mockImplementation(async (id, body) => {
    const photo = photos.find((p) => p.id === id);
    if (!photo) throw new Error('Not found');
    Object.assign(photo, body);
    return { ...photo };
  });
  vi.mocked(api.create).mockImplementation(
    async (file) => ({ ...seed[0], id: 'new', name: file.name }) as Photo,
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const button = (name: string) => screen.getByRole('button', { name });
async function loaded(path = '/') {
  render(<App initialPath={path} />);
  await waitFor(() => expect(api.list).toHaveBeenCalled());
  await screen.findByRole('button', { name: '湖畔の朝を開く' });
}
describe('photo application interactions', () => {
  it('loads, changes density and filters, selects and favorites', async () => {
    const user = userEvent.setup();
    await loaded();
    expect(screen.queryByRole('textbox', { name: '写真を検索' })).toBeNull();
    await user.click(button('写真を小さく表示'));
    await user.click(button('写真を大きく表示'));
    await user.click(button('湖畔の朝を選択'));
    // Deselecting and keyboard detail navigation work with common photo data.
    await user.click(button('湖畔の朝を選択'));
    await user.click(button('湖畔の朝を開く'));
    await user.click(button('次の写真'));
    expect(screen.getByRole('heading', { name: '山へ続く道' })).toBeTruthy();
    await user.click(button('前の写真'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await user.click(button('お気に入りを切り替え'));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith('1', { favorite: false }),
    );
    await user.click(button('写真の情報'));
    expect(screen.getByText('追加日（UTC）')).toBeTruthy();
    await user.click(button('アルバムに追加・解除'));
    await user.click(screen.getByRole('checkbox', { name: '空のアルバム' }));

    await waitFor(() =>
      expect(api.addAlbum).toHaveBeenCalledWith('1', '空のアルバム'),
    );
    await user.click(button('閉じる'));
    await user.click(button('写真を削除'));
    await user.click(button('キャンセル'));
    await user.click(button('写真を削除'));
    await user.click(button('ゴミ箱に移動'));
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: '湖畔の朝を開く' }),
      ).toBeNull(),
    );
    await user.click(screen.getByRole('link', { name: 'ゴミ箱' }));
    await user.click(button('湖畔の朝を開く'));
    await user.click(button('復元'));
    expect(
      await screen.findByRole('heading', { name: 'ゴミ箱は空です' }),
    ).toBeTruthy();
  });
  it('creates durable empty albums and handles duplicate and API failure', async () => {
    const user = userEvent.setup();
    render(<App initialPath="/albums" />);
    await screen.findByRole('button', { name: 'アルバムを作成' });
    await user.click(button('アルバムを作成'));
    const input = screen.getByRole('textbox', { name: 'アルバム名' });
    await user.type(input, '空のアルバム');
    await user.click(button('作成する'));
    expect(api.createAlbum).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, '新しい旅');
    vi.mocked(api.createAlbum).mockRejectedValueOnce(new Error('保存失敗'));
    await user.click(button('作成する'));
    await waitFor(() => expect(api.createAlbum).toHaveBeenCalledTimes(1));
    await user.click(button('作成する'));
    expect(
      await screen.findByRole('heading', { name: '新しい旅' }),
    ).toBeTruthy();
  });
  it('allows a file at the 50MiB limit', async () => {
    const user = userEvent.setup();
    await loaded();
    await user.click(button('写真を追加'));
    const input = document.querySelector('input[type=file]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing input');
    const file = new File(['fixture'], 'limit.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(file));
    expect(
      await screen.findByRole('button', { name: 'limit.pngを開く' }),
    ).toBeTruthy();
  });
  it('uploads only valid files and reports save failures', async () => {
    const user = userEvent.setup();
    await loaded();
    await user.click(button('写真を追加'));
    await user.click(screen.getByRole('button', { name: /写真を選択する/ }));
    const input = document.querySelector('input[type=file]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing input');
    fireEvent.change(input, {
      target: { files: [new File(['a'], 'new.png', { type: 'image/png' })] },
    });
    expect(
      await screen.findByRole('button', { name: 'new.pngを開く' }),
    ).toBeTruthy();
    fireEvent.change(input, {
      target: {
        files: [new File(['a'], 'bad.svg', { type: 'image/svg+xml' })],
      },
    });
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(50 * 1024 * 1024 + 1)], 'large.png', {
            type: 'image/png',
          }),
        ],
      },
    });
    vi.mocked(api.create).mockRejectedValueOnce(new Error('保存失敗'));
    fireEvent.change(input, {
      target: { files: [new File(['a'], 'failed.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2));
    expect(
      screen.queryByRole('button', { name: 'failed.pngを開く' }),
    ).toBeNull();
  });
  it('shows empty, favorite, missing photo and API errors with retry', async () => {
    vi.mocked(api.list).mockRejectedValueOnce(new Error('読み込みエラー'));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText('読み込みエラー')).toBeTruthy();
    await user.click(button('もう一度試す'));
    await screen.findByRole('button', { name: '湖畔の朝を開く' });
    await user.click(
      screen.getAllByRole('link', {
        name: 'お気に入り',
      })[0] as HTMLElement,
    );
    await user.click(button('湖畔の朝を開く'));
    vi.mocked(api.update).mockRejectedValueOnce(new Error('offline'));
    await user.click(button('お気に入りを切り替え'));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    cleanup();
    vi.mocked(api.list).mockResolvedValue([]);
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'まだ写真がありません' }),
    ).toBeTruthy();
    cleanup();
    render(<App initialPath="/photo/missing" />);
    expect(
      await screen.findByRole('heading', { name: '写真が見つかりません' }),
    ).toBeTruthy();
    await user.click(button('フォトに戻る'));
  });
});

it('一括移動で対象だけを除き再取得失敗から更新のみ再試行する', async () => {
  const user = userEvent.setup();
  vi.mocked(api.trashPhotos).mockImplementation(async ({ photoIds }) => {
    photos = photos.map((photo) =>
      photoIds.includes(photo.id) ? { ...photo, deleted: true } : photo,
    );
    vi.mocked(api.list).mockRejectedValueOnce(new Error('offline'));
  });
  await loaded('/album/秋の小旅行');
  await user.click(button('湖畔の朝を選択'));
  await user.click(button('山へ続く道を選択'));
  await user.click(button('ゴミ箱に移動'));
  await user.click(button('キャンセル'));
  expect(screen.getByText('2枚を選択中')).toBeTruthy();
  await user.click(button('ゴミ箱に移動'));
  const confirm = screen.getAllByRole('button', { name: 'ゴミ箱に移動' });
  await user.click(confirm[confirm.length - 1] as HTMLElement);
  await screen.findByRole('alert');
  expect(
    screen.queryByRole('button', { name: '湖畔の朝を開く', hidden: true }),
  ).toBeNull();
  expect(
    screen.getByRole('button', { name: '青い時間を開く', hidden: true }),
  ).toBeTruthy();
  await user.click(button('再取得'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(api.trashPhotos).toHaveBeenCalledTimes(1);
  expect(api.trashPhotos).toHaveBeenCalledWith({ photoIds: ['1', '2'] });
});

it('ダークUIはキーボードから複数選択し、0枚・終了・お気に入り保存を扱う', async () => {
  const user = userEvent.setup();
  render(<App designPreview />);
  const first = await screen.findByRole('button', { name: '湖畔の朝を開く' });
  expect(document.querySelector('.photo-select')).toBeNull();
  first.focus();
  await user.keyboard('{Shift>}{Enter}{/Shift}');
  expect(screen.getByRole('status', { name: '1枚を選択中' })).toBeTruthy();
  await user.click(button('山へ続く道を選択'));
  expect(screen.getByRole('status', { name: '2枚を選択中' })).toBeTruthy();
  await user.click(button('湖畔の朝を選択'));
  await user.click(button('山へ続く道を選択'));
  expect(screen.getByRole('status', { name: '0枚を選択中' })).toBeTruthy();
  expect(button('お気に入り').hasAttribute('disabled')).toBe(true);
  await user.click(button('山へ続く道を選択'));
  await user.click(button('お気に入り'));
  await waitFor(() =>
    expect(document.querySelector('.selection-panel')).toBeNull(),
  );
  expect(api.update).toHaveBeenCalledWith('2', { favorite: true });
  await user.click(button('山へ続く道を開く'));
  expect(
    await screen.findByRole('heading', { name: '山へ続く道' }),
  ).toBeTruthy();
});
it('ダークUIで選択を解除し、選択した写真を既存アルバムへ追加する', async () => {
  const user = userEvent.setup();
  vi.mocked(api.addPhotosAlbum).mockResolvedValue(undefined);
  render(<App designPreview />);
  const first = await screen.findByRole('button', { name: '湖畔の朝を開く' });
  first.focus();
  await user.keyboard('{Shift>}{Enter}{/Shift}');
  await user.click(button('選択解除'));
  expect(document.querySelector('.photo-select')).toBeNull();
  button('湖畔の朝を開く').focus();
  await user.keyboard('{Shift>}{Enter}{/Shift}');
  await user.click(button('アルバムに追加'));
  await user.selectOptions(
    screen.getByRole('combobox', { name: '追加先' }),
    '空のアルバム',
  );
  await user.click(button('追加'));
  await waitFor(() =>
    expect(document.querySelector('.selection-panel')).toBeNull(),
  );
});
