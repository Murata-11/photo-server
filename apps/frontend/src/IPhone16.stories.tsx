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
          '写真詳細の「写真に保存」から元画像を準備し、共有画面を開く。iPhoneでは「画像を保存」を選ぶ。準備中・取得失敗と再試行・共有キャンセル/失敗・非対応時のダウンロードを扱う。共有の完了は写真保存の成功と扱わない。ネイティブの共有画面はiPhone実機で確認する。',
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
