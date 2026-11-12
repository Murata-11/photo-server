import { useEffect, useRef, useState } from 'react';

// Keep the app at desktop CSS dimensions, including on a narrow review screen.
export function DesktopPreview() {
  const canvas = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const source =
    './iframe.html?id=' +
    encodeURIComponent('pc-デスクトップ--playground') +
    '&viewMode=story&desktopCanvas=1';
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / 1440);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <section className="desktop-preview-stage" aria-label="PC画面モック">
      <header className="desktop-preview-heading">
        <span>ひより DESKTOP PREVIEW</span>
        <h1>PCで、思い出をゆっくり。</h1>
        <p>1440 × 960 CSS px · 画面幅に合わせて縮小表示</p>
      </header>
      <div
        ref={canvas}
        className="desktop-preview-canvas"
        style={{ height: 960 * scale }}
      >
        <iframe
          title="PCの写真アプリ"
          src={source}
          width={1440}
          height={960}
          style={{ transform: `scale(${scale})` }}
        />
      </div>
      <p className="desktop-preview-note">
        画面の中をクリックして操作できます。
        <a href={source} target="_blank" rel="noopener noreferrer">
          画面を直接開く
        </a>
      </p>
    </section>
  );
}
