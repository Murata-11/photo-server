import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App';
import { uploadFixture } from './mocks/scenarios';
const meta = {
  title: 'Issue 20/48MPアップロード',
  component: App,
  parameters: { layout: 'fullscreen' },
  args: { initialUploadOpen: true },
  beforeEach: () => uploadFixture(),
} satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;
// ファイルを選択すると各状態へ進む。実アプリと共通の表示・入力検証。
export const Normal: Story = {};
export const Saving: Story = { beforeEach: () => uploadFixture('saving') };
export const PixelLimit: Story = { beforeEach: () => uploadFixture('pixels') };
export const Corrupt: Story = { beforeEach: () => uploadFixture('corrupt') };
export const Mismatch: Story = { beforeEach: () => uploadFixture('mismatch') };
export const Multiple: Story = { beforeEach: () => uploadFixture('multiple') };
export const Unsupported: Story = {
  beforeEach: () => uploadFixture('unsupported'),
};
export const Busy: Story = { beforeEach: () => uploadFixture('busy') };
