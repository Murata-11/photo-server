import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App';
import { resetStore } from './mocks/scenarios';
const meta = {
  title: 'アプリ/ひより',
  component: App,
  parameters: { layout: 'fullscreen' },
  beforeEach: () => resetStore(),
  args: { initialPath: '/' },
} satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = { name: 'アプリを操作する' };
export const Favorites: Story = {
  name: 'お気に入りから開始',
  args: { initialPath: '/favorites' },
};
export const Albums: Story = {
  name: 'アルバムから開始',
  args: { initialPath: '/albums' },
};
export const Empty: Story = {
  name: '写真がない状態',
  beforeEach: () => resetStore('empty'),
};
export const Error: Story = {
  name: '読み込みエラー',
  beforeEach: () => resetStore('error'),
};
export const Loading: Story = {
  name: '読み込み中',
  beforeEach: () => resetStore('loading'),
};
