import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App';
import { DesktopPreview } from './DesktopPreview';
import { seed } from './mocks/data';
import { resetStore } from './mocks/scenarios';

function Preview() {
  return new URLSearchParams(window.location.search).has('desktopCanvas') ? (
    <App />
  ) : (
    <DesktopPreview />
  );
}
const meta = {
  title: 'PC/デスクトップ',
  component: Preview,
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    docs: {
      description: {
        story:
          '一覧は表示用画像、写真詳細は元画像のimgを表示する。画像の右クリック・長押しの標準メニューを許可し、保存メニューから別タブの元画像プレビューとダウンロードも選べる。',
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
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = { name: 'PCで操作する' };
