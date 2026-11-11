import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { api } from './lib/api';
import type { components } from './lib/api.generated';
type Photo = components['schemas']['Photo'];
export function AlbumEditor({
  photo,
  open = true,
  names,
  onPhotos,
  onClose,
}: {
  photo: Photo;
  open?: boolean;
  names: string[];
  onPhotos: (photos: Photo[]) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState(photo.albums);
  useEffect(() => {
    if (open) {
      setOrdered(
        [...names].sort(
          (a, b) =>
            Number(chosen.includes(b)) - Number(chosen.includes(a)) ||
            a.localeCompare(b, 'ja'),
        ),
      );
    }
  }, [open]);
  const [pending, setPending] = useState<string[]>([]);
  const [failures, setFailures] = useState<Record<string, boolean>>({});
  const [refreshError, setRefreshError] = useState(false);
  const active = useRef(new Set<string>());
  const revision = useRef(0);
  const failedRows = useRef(new Set<string>());
  const mounted = useRef(true);
  const isOpen = useRef(open);
  isOpen.current = open;
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const panel = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({ top: 0, right: 16 });
  useEffect(() => {
    if (!open) return;
    function place() {
      const detail = document.querySelector('.detail')?.getBoundingClientRect();
      const trigger = document
        .querySelector('[data-album-editor-trigger]')
        ?.getBoundingClientRect();
      setPosition({
        top: Math.max(
          8,
          Math.min(
            (detail?.top ?? trigger?.bottom ?? 0) + 48,
            window.innerHeight - 220,
          ),
        ),
        right: Math.max(
          16,
          window.innerWidth - (detail?.right ?? window.innerWidth - 16),
        ),
      });
    }
    function outside(e: MouseEvent) {
      if (
        e.target instanceof Element &&
        !(panel.current && e.composedPath().includes(panel.current)) &&
        !e.target.closest('[data-album-editor-trigger]')
      )
        onClose();
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        document
          .querySelector<HTMLButtonElement>('[data-album-editor-trigger]')
          ?.focus();
      }
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('click', outside);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('click', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, onClose]);
  const [ordered, setOrdered] = useState(() =>
    [...names].sort(
      (a, b) =>
        Number(photo.albums.includes(b)) - Number(photo.albums.includes(a)) ||
        a.localeCompare(b, 'ja'),
    ),
  );
  async function refresh() {
    const version = revision.current;
    try {
      const photos = await api.list();
      if (version === revision.current && !active.current.size) {
        const latest = photos.find((p) => p.id === photo.id);
        if (latest)
          setChosen((prev) => [
            ...latest.albums.filter((n) => !failedRows.current.has(n)),
            ...prev.filter((n) => failedRows.current.has(n)),
          ]);
        onPhotos(photos);
        setRefreshError(false);
      }
    } catch {
      setRefreshError(true);
      if (!mounted.current || !isOpen.current)
        toast.error('最新のアルバム所属を取得できませんでした');
    }
  }
  async function change(name: string, adding: boolean) {
    if (active.current.has(name)) return;
    active.current.add(name);
    failedRows.current.delete(name);
    revision.current++;
    setPending([...active.current]);
    setFailures((prev) => {
      return Object.fromEntries(
        Object.entries(prev).filter(([key]) => key !== name),
      );
    });
    setChosen((prev) =>
      adding ? [...new Set([...prev, name])] : prev.filter((n) => n !== name),
    );
    try {
      await (adding ? api.addAlbum : api.removeAlbum)(photo.id, name);
    } catch {
      setChosen((prev) =>
        adding ? prev.filter((n) => n !== name) : [...new Set([...prev, name])],
      );
      failedRows.current.add(name);
      setFailures((prev) => ({ ...prev, [name]: adding }));
      if (!mounted.current || !isOpen.current)
        toast.error(
          `${name}の所属を保存・確認できませんでした。再度開いて確認してください。`,
        );
    } finally {
      active.current.delete(name);
      setPending([...active.current]);
      if (!active.current.size) await refresh();
    }
  }
  if (!open) return null;
  return (
    <aside
      ref={panel}
      className="info-panel album-editor"
      role="region"
      aria-label="アルバムに追加・解除"
      style={{
        top: position.top,
        right: position.right,
        maxHeight: Math.min(
          420,
          Math.max(96, window.innerHeight - position.top - 16),
        ),
      }}
    >
      <header className="album-editor-header">
        <h2>アルバムに追加・解除</h2>
        <button type="button" aria-label="閉じる" onClick={onClose}>
          <X size={16} />
        </button>
      </header>
      <div className="album-editor-list" role="group" aria-label="所属アルバム">
        {!names.length ? (
          <p>アルバムを作成すると追加できます。</p>
        ) : (
          ordered.map((name) => (
            <div key={name} className="album-editor-row">
              <label>
                <input
                  type="checkbox"
                  checked={chosen.includes(name)}
                  disabled={pending.includes(name)}
                  onChange={(e) => change(name, e.target.checked)}
                />
                <span>{name}</span>
              </label>
              {name in failures && (
                <div role="alert">
                  <p>保存・確認できませんでした</p>
                  <button
                    type="button"
                    aria-label={`${name}を再試行`}
                    onClick={() => change(name, failures[name] === true)}
                  >
                    再試行
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {refreshError && (
        <footer className="album-editor-footer">
          <p role="alert">最新の所属を取得できませんでした</p>
          <button type="button" onClick={refresh}>
            最新情報を再取得
          </button>
        </footer>
      )}
    </aside>
  );
}
