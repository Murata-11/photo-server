import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App';
import { BulkTrashDialog } from './BulkTrashDialog';
import { trashFixture } from './mocks/scenarios';
const meta = {
  title: 'Issue 26/写真の一括ゴミ箱移動',
  component: App,
  args: { designPreview: false },
  parameters: { layout: 'fullscreen' },
  beforeEach: () => trashFixture(),
} satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Normal: Story = {};
export const Album: Story = { args: { initialPath: '/album/秋の小旅行' } };
export const Favorites: Story = { args: { initialPath: '/favorites' } };
export const Trash: Story = { args: { initialPath: '/trash' } };
export const Saving: Story = { beforeEach: () => trashFixture('saving') };
export const Error: Story = { beforeEach: () => trashFixture('error') };
export const Unknown: Story = { beforeEach: () => trashFixture('unknown') };
export const RefreshError: Story = {
  beforeEach: () => trashFixture('refresh'),
};
export const NotFound: Story = { beforeEach: () => trashFixture('missing') };
export const OverLimit: Story = {
  render: () => (
    <BulkTrashDialog
      open
      onOpenChange={() => {}}
      photoIds={Array.from({ length: 101 }, (_, i) => String(i))}
      onSaved={() => {}}
      onReload={() => Promise.resolve()}
    />
  ),
};
