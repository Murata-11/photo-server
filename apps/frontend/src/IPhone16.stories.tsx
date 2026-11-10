import type { Meta, StoryObj } from '@storybook/react-vite';

// iframeで実際の393px幅を作り、共通AppのレスポンシブUIを表示する。
// デスクトップ上でもCSSのmedia query・ダイアログ・固定ナビを同条件で確認できる。
function IPhone16Preview() {
  const source =
    './iframe.html?id=' +
    encodeURIComponent('アプリ-ひより--playground') +
    '&viewMode=story';
  return (
    <div className="iphone-preview-stage">
      <div className="iphone-preview-heading">
        <span>ひより MOBILE PREVIEW</span>
        <h1>ふたりの思い出を、手のひらに。</h1>
        <p>iPhone 16 · 393 × 852 CSS px</p>
      </div>
      <div className="iphone-device">
        <iframe
          title="iPhone 16の写真アプリ"
          src={source}
          width={393}
          height={852}
        />
      </div>
      <p className="iphone-preview-note">
        画面の中をタップして、そのまま操作できます。
        <br />
        Web表示のモックです。Safariのブラウザーバー・実機のセーフエリアは再現していません。
      </p>
    </div>
  );
}
const meta = {
  title: 'スマートフォン/iPhone 16',
  component: IPhone16Preview,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof IPhone16Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = { name: 'iPhone 16でアプリを操作する' };
