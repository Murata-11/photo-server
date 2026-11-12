import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App';
import { resetStore } from './mocks/scenarios';

const meta = {
  title: 'Issue 23/検索バーのない画面',
  component: App,
  args: { designPreview: false },
  parameters: { layout: 'fullscreen' },
  beforeEach: () => resetStore(),
} satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Photos: Story = {};
export const Albums: Story = { args: { initialPath: '/albums' } };
export const Favorites: Story = { args: { initialPath: '/favorites' } };
export const Trash: Story = { args: { initialPath: '/trash' } };
export const Detail: Story = { args: { initialPath: '/photo/1' } };
export const Upload: Story = { args: { initialUploadOpen: true } };
export const Empty: Story = { beforeEach: () => resetStore('empty') };
export const Loading: Story = { beforeEach: () => resetStore('loading') };
export const Error: Story = { beforeEach: () => resetStore('error') };
