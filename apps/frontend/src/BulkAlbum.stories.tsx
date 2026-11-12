import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App';
import { bulkFixture } from './mocks/scenarios';
const meta = {
  title: 'Issue 22/写真の一括アルバム追加',
  component: App,
  args: { designPreview: false },
  parameters: { layout: 'fullscreen' },
  beforeEach: () => bulkFixture(),
} satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;
// 写真を複数選択→選択バーの「アルバムに追加」。通常アプリと同じコンポーネント。
export const Normal: Story = {};
export const Saving: Story = { beforeEach: () => bulkFixture('saving') };
export const Error: Story = { beforeEach: () => bulkFixture('error') };
export const Unknown: Story = { beforeEach: () => bulkFixture('unknown') };
export const RefreshError: Story = { beforeEach: () => bulkFixture('refresh') };
export const NoAlbums: Story = {
  beforeEach: () => bulkFixture('normal', true),
};
