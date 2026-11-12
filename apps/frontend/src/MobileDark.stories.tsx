import { waitFor } from '@testing-library/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App';
import { IPhone16Preview } from './IPhone16.stories';
import { seed } from './mocks/data';
import { resetStore } from './mocks/scenarios';

const meta = {
  title: 'デザイン提案/モバイルダーク',
  component: App,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '参考画像をもとにしたUIレビュー案。サイドバーとメニューボタンを表示せず、PCでも下部ナビから操作します。ヘッダーはスクロールに追従せず、フォト・アルバム・作成のナビは背景不透明度35%で浮かべます。フォトは見出し・枚数・表示切替・絞り込み・並び順を省き、日付の区切りがない写真グリッドを表示し、スクロール中は上端の写真のアップロード週（UTC）を半透明ラベルで示します。通常時は選択の丸を表示せず、500msの長押し（キーボードはShift+Enter）で複数選択に入ります。選択中は上部に選択数、下部にアルバム追加・お気に入り・ゴミ箱への移動を表示します。共通Appと既存APIを使用し、通常起動は従来のデザインを維持します。393×852でのレビューを推奨。',
      },
    },
  },
  beforeEach: () =>
    resetStore(
      'normal',
      seed.map((photo, index) => ({
        ...photo,
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        createdAt: photo.date + 'T12:00:00.000Z',
      })),
    ),
  args: { designPreview: true, initialPath: '/' },
} satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Photos: Story = { name: 'フォト' };
export const Albums: Story = {
  name: 'アルバム',
  args: { initialPath: '/albums' },
};
export const Album: Story = {
  name: 'アルバムの中',
  args: { initialPath: '/album/秋の小旅行' },
};
export const Detail: Story = {
  name: '写真詳細',
  args: { initialPath: '/photo/00000000-0000-4000-8000-000000000001' },
};
export const Upload: Story = {
  name: '写真を追加',
  args: { initialUploadOpen: true },
};
export const Empty: Story = {
  name: '写真なし',
  beforeEach: () => resetStore('empty'),
};
export const Loading: Story = {
  name: '読み込み中',
  beforeEach: () => resetStore('loading'),
};
export const Error: Story = {
  name: '読み込み失敗',
  beforeEach: () => resetStore('error'),
};

export const IPhone16: Story = {
  name: 'iPhone 16で操作する',
  render: () => (
    <IPhone16Preview storyId="デザイン提案-モバイルダーク--photos" />
  ),
};

export const Selection: Story = {
  name: '長押し後の複数選択',
  play: async ({ canvasElement }) => {
    const photo = await waitFor(() => {
      const button =
        canvasElement.querySelector<HTMLButtonElement>('.photo-open');
      if (!button) throw new globalThis.Error('写真を読み込み中');
      return button;
    });
    photo.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true,
      }),
    );
  },
};
