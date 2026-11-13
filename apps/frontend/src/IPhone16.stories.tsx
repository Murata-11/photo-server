import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App';
import { IPhone16Preview } from './IPhone16Preview';
import { seed } from './mocks/data';
import { resetStore, albumDeletionFixture } from './mocks/scenarios';

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
          '一覧は表示用画像、写真詳細は元画像のimgを表示し、詳細画像の長押しメニューを許可する。ダウンロードボタンは元ファイルを直接ダウンロードする。保存方法を選ぶダイアログは表示しない。Safari固有の保存項目は実機で確認する。アルバム内の削除ボタンから名前と写真保持を確認し、アルバムのみ削除できる。',
      },
    },
  },
  beforeEach: () => {
    resetStore(
      'normal',
      seed.map((photo, index) => ({
        ...photo,
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        createdAt: photo.date + 'T12:00:00.000Z',
      })),
    );
    albumDeletionFixture(
      new URLSearchParams(window.location.search).get('albumDeletion'),
    );
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = { name: 'iPhone 16で操作する' };
