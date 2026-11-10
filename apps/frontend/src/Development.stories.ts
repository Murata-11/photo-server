import type { Meta, StoryObj } from '@storybook/html-vite';

// 開発環境の疎通確認専用。製品の画面・コンポーネント仕様ではない。
const meta = {
  title: 'Development/Environment',
  render: () => `
    <main lang="ja">
      <h1>Storybook 開発環境</h1>
      <p>Storyの表示を確認できました。</p>
      <p>これは環境確認用です。製品の画面仕様は未定義です。</p>
    </main>
  `,
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
