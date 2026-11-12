import { useEffect, useRef } from 'react';
import { Check, Heart } from 'lucide-react';
import type { components } from './lib/api.generated';
type Photo = components['schemas']['Photo'];

export function SelectablePhotoTile({
  photo,
  selected,
  selecting,
  onOpen,
  onToggle,
  onLongPress,
  onKeyboardSelect,
  onPointerStart,
}: {
  photo: Photo;
  selected: boolean;
  selecting: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onLongPress: () => void;
  onKeyboardSelect: () => void;
  onPointerStart: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const origin = useRef<{ x: number; y: number } | null>(null);
  function cancel() {
    clearTimeout(timer.current);
    timer.current = undefined;
    origin.current = null;
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div
      className={`photo-tile ${selected ? 'selected' : ''}`}
      data-uploaded-at={photo.createdAt}
    >
      <button
        className="photo-open"
        aria-label={`${photo.name}を${selecting ? '選択' : '開く'}`}
        aria-pressed={selecting ? selected : undefined}
        aria-description={
          selecting ? undefined : '長押し、またはShiftとEnterで複数選択'
        }
        onPointerDown={(event) => {
          if (event.button !== 0 || event.isPrimary === false) return;
          onPointerStart();
          cancel();
          if (selecting) return;
          origin.current = { x: event.clientX, y: event.clientY };
          timer.current = setTimeout(() => {
            timer.current = undefined;
            origin.current = null;
            onLongPress();
          }, 500);
        }}
        onPointerMove={(event) => {
          if (
            origin.current &&
            Math.hypot(
              event.clientX - origin.current.x,
              event.clientY - origin.current.y,
            ) > 10
          )
            cancel();
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.shiftKey && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            cancel();
            onKeyboardSelect();
          }
        }}
        onClick={selecting ? onToggle : onOpen}
      >
        <img
          loading="lazy"
          draggable={false}
          src={photo.src}
          alt={photo.name}
        />
        <span className="tile-shade" />
        <span className="tile-name">{photo.name}</span>
      </button>
      {selecting && (
        <button
          className="photo-select"
          aria-label={`${photo.name}の選択を${selected ? '解除' : '追加'}`}
          aria-pressed={selected}
          onPointerDown={onPointerStart}
          onClick={onToggle}
        >
          <Check size={16} />
        </button>
      )}
      {photo.favorite && (
        <Heart className="tile-heart" size={17} fill="white" />
      )}
    </div>
  );
}
