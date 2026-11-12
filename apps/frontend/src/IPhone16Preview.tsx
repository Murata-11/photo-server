import { useEffect, useRef, useState } from 'react';

// iframeで実際の393px幅を作り、共通AppのレスポンシブUIを表示する。
// デスクトップ上でもCSSのmedia query・ダイアログ・固定ナビを同条件で確認できる。
export function IPhone16Preview({
  storyId = 'スマートフォン-iphone-16--playground',
}: {
  storyId?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  useEffect(() => {
    setStatus('loading');
    const interval = window.setInterval(() => {
      try {
        const doc = frame.current?.contentDocument;
        if (doc?.querySelector('.app-shell')) {
          setStatus('ready');
          window.clearInterval(interval);
          window.clearTimeout(timeout);
        } else if (doc?.body.classList.contains('sb-show-errordisplay')) {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    }, 200);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setStatus('error');
    }, 15000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [attempt, storyId]);
  const source =
    './iframe.html?id=' +
    encodeURIComponent(storyId) +
    '&viewMode=story&smartphoneCanvas=1&previewAttempt=' +
    attempt;
  return (
    <div className="iphone-preview-stage">
      <div className="iphone-preview-heading">
        <span>ひより MOBILE PREVIEW</span>
        <h1>ふたりの思い出を、手のひらに。</h1>
        <p>iPhone 16 · 393 × 852 CSS px</p>
      </div>
      <div className="iphone-device">
        <iframe
          ref={frame}
          key={attempt}
          title="iPhone 16の写真アプリ"
          src={source}
          width={393}
          height={852}
        />
        {status !== 'ready' && (
          <div
            className="iphone-preview-status"
            role={status === 'error' ? 'alert' : 'status'}
          >
            {status === 'loading' ? (
              <p>プレビューを読み込んでいます…</p>
            ) : (
              <>
                <p>プレビューを読み込めませんでした。</p>
                <p>通信状態を確認して、もう一度お試しください。</p>
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  再読み込み
                </button>
                <a href={source} target="_blank" rel="noreferrer">
                  画面を直接開く
                </a>
              </>
            )}
          </div>
        )}
      </div>
      <p className="iphone-preview-note">
        画面の中をタップして、そのまま操作できます。
        <br />
        Web表示のモックです。Safariのブラウザーバー・実機のセーフエリアは再現していません。
      </p>
    </div>
  );
}
