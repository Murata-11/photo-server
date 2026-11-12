import { useEffect, useRef, useState, type ReactNode } from 'react';

function uploadPeriod(value: string) {
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return 'アップロード日不明';
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  if (start.getTime() === now.getTime()) return '今週';
  const year = start.getUTCFullYear() !== now.getUTCFullYear();
  const from = `${year ? start.getUTCFullYear() + '年' : ''}${start.getUTCMonth() + 1}月${start.getUTCDate()}日`;
  const to = `${end.getUTCFullYear() !== start.getUTCFullYear() ? end.getUTCFullYear() + '年' : ''}${end.getUTCMonth() !== start.getUTCMonth() ? end.getUTCMonth() + 1 + '月' : ''}${end.getUTCDate()}日`;
  return `${from}〜${to}`;
}

/** A continuous grid; the upper visible row determines the upload week in UTC. */
export function ContinuousPhotoGrid({ children }: { children: ReactNode }) {
  const grid = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState('');
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const element = grid.current;
      if (!element) return;
      const bounds = element.getBoundingClientRect();
      const edge = 80;
      if (bounds.top > 0 || bounds.bottom <= edge) {
        setPeriod('');
        return;
      }
      const photo = Array.from(element.children).find(
        (tile) => tile.getBoundingClientRect().bottom > edge,
      );
      const uploadedAt = photo?.getAttribute('data-uploaded-at');
      setPeriod(uploadedAt ? uploadPeriod(uploadedAt) : '');
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <>
      <div
        className="upload-period"
        aria-label="アップロード期間（UTC）"
        hidden={!period}
      >
        {period}
      </div>
      <div ref={grid} className="photo-grid continuous-photo-grid">
        {children}
      </div>
    </>
  );
}
