import { useRef } from 'react';

export function SwipePhotoStage({
  src,
  name,
  onPrevious,
  onNext,
}: {
  src: string;
  name: string;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  return (
    <div
      className="detail-stage swipe-photo-stage"
      role="group"
      aria-label="写真ビューアー。左右スワイプまたは左右キーで写真を移動"
      onPointerDown={(event) => {
        start.current = null;
        if (event.button !== 0 || event.isPrimary === false) return;
        start.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerUp={(event) => {
        const origin = start.current;
        start.current = null;
        if (!origin || origin.id !== event.pointerId) return;
        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;
        if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
        if (dx < 0) onNext?.();
        else onPrevious?.();
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onLostPointerCapture={() => {
        start.current = null;
      }}
    >
      <img className="detail-image" src={src} alt={name} draggable={false} />
    </div>
  );
}
