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
  parameters: { layout: 'fullscreen', controls: { disable: true } },
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
