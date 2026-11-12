import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App';
import { IPhone16Preview } from './IPhone16Preview';
import { seed } from './mocks/data';
import { resetStore } from './mocks/scenarios';

function Preview() {
  return new URLSearchParams(window.location.search).has('smartphoneCanvas') ? (
    <App />
  ) : (
    <IPhone16Preview />
  );
}
const meta = {
  title: 'スマートフォン/iPhone 16',
  component: Preview,
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    docs: {
      description: {
        story:
          '一覧は表示用画像、写真詳細は元画像のimgを表示し、詳細画像の長押しメニューを許可する。「写真に保存」から元画像を新しいタブでプレビューする。iPhoneではSafariの共有ボタンまたは画像の長押しから保存する。通常ダウンロードも選べる。Safari固有の保存項目は実機で確認する。',
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
export const Playground: Story = { name: 'iPhone 16で操作する' };
