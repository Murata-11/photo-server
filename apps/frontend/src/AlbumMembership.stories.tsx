import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App';
import { membershipFixture } from './mocks/scenarios';
const meta = {
  title: 'Issue 21/複数アルバム',
  component: App,
  parameters: { layout: 'fullscreen' },
  args: { initialPath: '/photo/1' },
  beforeEach: () => membershipFixture('normal'),
} satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;
// 「写真の情報」を開く。保存中・失敗はチェックを変更して確認する。
export const Multiple: Story = { name: '複数所属・追加と解除' };
export const Saving: Story = {
  name: '所属保存中',
  beforeEach: () => membershipFixture('saving'),
};
export const Error: Story = {
  name: '所属保存失敗',
  beforeEach: () => membershipFixture('error'),
};
export const NoAlbums: Story = {
  name: 'アルバム0件・未所属',
  beforeEach: () => membershipFixture('normal', true),
};
export const Trash: Story = {
  name: 'ゴミ箱内で所属編集',
  beforeEach: () => membershipFixture('normal', false, true),
};
