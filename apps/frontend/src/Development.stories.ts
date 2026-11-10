import { createElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

// 開発環境の疎通確認専用。製品の画面・コンポーネント仕様ではない。
const meta = {
  title: 'Development/Environment',
  render: () =>
    createElement(
      'main',
      { lang: 'ja' },
      createElement('h1', null, 'Storybook 開発環境'),
      createElement('p', null, 'Storyの表示を確認できました。'),
    ),
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
