import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from './components/ui/button';

export function SwipePhotoStage({
  src,
  name,
  onPrevious,
  onNext,
  initialArrowsVisible = false,
  onArrowsChange,
}: {
  src: string;
  name: string;
  onPrevious?: () => void;
  onNext?: () => void;
  initialArrowsVisible?: boolean;
  onArrowsChange?: (visible: boolean) => void;
}) {
  const [arrowsVisible, setArrowsVisible] = useState(initialArrowsVisible);
  const start = useRef<{
    id: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  function toggleArrows() {
    const visible = !arrowsVisible;
    setArrowsVisible(visible);
    onArrowsChange?.(visible);
  }
  return (
    <div
      className="detail-stage swipe-photo-stage"
      role="group"
      aria-label="写真ビューアー。左右スワイプ・左右キーで移動、タップ・Enterで矢印を切り替え"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault();
          toggleArrows();
        }
      }}
      onPointerDown={(event) => {
        start.current = null;
        if (
          event.button !== 0 ||
          event.isPrimary === false ||
          (event.target as Element).closest('button')
        )
          return;
        start.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          moved: false,
        };
        // Touch already captures implicitly on the image. Keep its native save menu.
        if (event.pointerType !== 'touch')
          event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (
          start.current &&
          Math.hypot(
            event.clientX - start.current.x,
            event.clientY - start.current.y,
          ) > 10
        )
          start.current.moved = true;
      }}
      onPointerUp={(event) => {
        const origin = start.current;
        start.current = null;
        if (!origin || origin.id !== event.pointerId) return;
        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;
        if (!origin.moved && Math.hypot(dx, dy) <= 10) {
          toggleArrows();
          return;
        }
        if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
        if (dx < 0) onNext?.();
        else onPrevious?.();
      }}
      onContextMenu={() => {
        // Do not cancel the native menu or treat its release as a tap/swipe.
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onLostPointerCapture={() => {
        start.current = null;
      }}
    >
      <img className="detail-image" src={src} alt={name} draggable={false} />
      {arrowsVisible && (
        <>
          <Button
            className="previous-photo"
            variant="outline"
            size="icon"
            aria-label="前の写真"
            disabled={!onPrevious}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={onPrevious}
          >
            <ArrowLeft size={20} />
          </Button>
          <Button
            className="next-photo"
            variant="outline"
            size="icon"
            aria-label="次の写真"
            disabled={!onNext}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={onNext}
          >
            <ArrowRight size={20} />
          </Button>
        </>
      )}
    </div>
  );
}
