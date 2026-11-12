import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App';
import mobile from './MobileDark.stories';
import { resetStore } from './mocks/scenarios';

const meta = {
  title: 'Issue 44/外観設定',
  component: App,
  beforeEach: mobile.beforeEach,
  args: { appearancePreview: { initial: 'system', system: 'light' } },
  parameters: {
    docs: {
      description: {
        component:
          '仕様レビュー案。右上のアカウントメニューから外観を選択できます。appearancePreview.systemをControlsで変更するとOS変更を再現できます。保存・実OS追従・初回描画制御は後続実装です。通常アプリはダーク固定を維持します。',
      },
    },
  },
} satisfies Meta<typeof App>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SystemLight: Story = { name: '自動：システムがライト' };
export const SystemDark: Story = {
  name: '自動：システムがダーク',
  args: { appearancePreview: { initial: 'system', system: 'dark' } },
};
export const ManualLight: Story = {
  name: '手動ライト：システムはダーク',
  args: { appearancePreview: { initial: 'light', system: 'dark' } },
};
export const ManualDark: Story = {
  name: '手動ダーク：システムはライト',
  args: { appearancePreview: { initial: 'dark', system: 'light' } },
};
export const Albums: Story = { args: { initialPath: '/albums' } };
export const Album: Story = { args: { initialPath: '/album/秋の小旅行' } };
export const Detail: Story = {
  args: { initialPath: '/photo/00000000-0000-4000-8000-000000000001' },
};
export const Upload: Story = { args: { initialUploadOpen: true } };
export const Favorites: Story = { args: { initialPath: '/favorites' } };
export const Trash: Story = { args: { initialPath: '/trash' } };
export const Empty: Story = { beforeEach: () => resetStore('empty') };
export const Loading: Story = { beforeEach: () => resetStore('loading') };
export const Error: Story = { beforeEach: () => resetStore('error') };
export const StorageUnavailable: Story = {
  name: '保存できない場合',
  args: {
    appearancePreview: {
      initial: 'system',
      system: 'light',
      storageUnavailable: true,
    },
  },
};

// Review-only OS simulator; the product implementation will use matchMedia.
export const SystemChange: Story = {
  name: '表示中のシステム変更',
  render: function SystemChangePreview(args) {
    const [system, setSystem] = useState<'light' | 'dark'>('light');
    return (
      <>
        <button
          className="appearance-simulator"
          onClick={() =>
            setSystem((value) => (value === 'light' ? 'dark' : 'light'))
          }
        >
          レビュー用：システムを{system === 'light' ? 'ダーク' : 'ライト'}へ変更
        </button>
        <App {...args} appearancePreview={{ initial: 'system', system }} />
      </>
    );
  },
};
