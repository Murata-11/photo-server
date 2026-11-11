import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App';
import { IPhone16Preview } from './IPhone16.stories';
import { resetStore } from './mocks/scenarios';

const meta = {
  title: 'デザイン提案/モバイルダーク',
  component: App,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '参考画像をもとにしたUIレビュー案。フォト・アルバム・作成のフローティングナビ。フォトは見出し・枚数・表示切替・絞り込み・並び順を省き、日付別の写真をすぐに表示します。共通Appと既存APIを使用し、通常起動は従来のデザインを維持します。393×852でのレビューを推奨。',
      },
    },
  },
  beforeEach: () => resetStore(),
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
  args: { initialPath: '/photo/1' },
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
