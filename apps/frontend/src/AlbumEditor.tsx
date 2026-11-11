import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './components/ui/dialog';
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
  const [query, setQuery] = useState('');
  const [onlyMember, setOnlyMember] = useState(false);
  useEffect(() => {
    if (open) {
      setQuery('');
      setOnlyMember(false);
      setOrdered(
        [...names].sort(
          (a, b) =>
            Number(chosen.includes(b)) - Number(chosen.includes(a)) ||
            a.localeCompare(b, 'ja'),
        ),
      );
      setAnchor(
        document
          .querySelector('[data-album-editor-trigger]')
          ?.getBoundingClientRect(),
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
  const [anchor, setAnchor] = useState(() =>
    document
      .querySelector('[data-album-editor-trigger]')
      ?.getBoundingClientRect(),
  );
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
  const visible = ordered.filter(
    (n) =>
      (!onlyMember ||
        chosen.includes(n) ||
        pending.includes(n) ||
        n in failures) &&
      n.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="album-editor"
        style={
          {
            '--album-anchor-top': `${Math.min(anchor?.bottom ?? 120, window.innerHeight * 0.35) + 8}px`,
            '--album-anchor-right': `${anchor?.right ?? window.innerWidth - 16}px`,
          } as React.CSSProperties
        }
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLButtonElement>('[data-album-editor-trigger]')
              ?.focus({ preventScroll: true }),
          );
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onClose();
        }}
        onPointerDownOutside={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <header className="album-editor-header">
          <DialogTitle className="dialog-title">
            アルバムに追加・解除
          </DialogTitle>
          <DialogDescription>
            チェックを変更すると自動で保存します。
          </DialogDescription>
          <label>
            アルバムを検索
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div
            className="album-editor-tabs"
            role="group"
            aria-label="アルバムの絞り込み"
          >
            <button
              type="button"
              aria-pressed={!onlyMember}
              onClick={() => setOnlyMember(false)}
            >
              すべて
            </button>
            <button
              type="button"
              aria-pressed={onlyMember}
              onClick={() => setOnlyMember(true)}
            >
              所属中
            </button>
            <span>{chosen.length}件に所属</span>
          </div>
        </header>
        <fieldset className="album-editor-list">
          <legend className="sr-only">所属アルバム</legend>
          {!names.length ? (
            <p>アルバムを作成すると追加できます。</p>
          ) : !visible.length ? (
            <p>該当するアルバムがありません</p>
          ) : (
            visible.map((name) => (
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
                {pending.includes(name) && <p role="status">保存中</p>}
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
        </fieldset>
        {refreshError && (
          <footer className="album-editor-footer">
            <p role="alert">最新の所属を取得できませんでした</p>
            <button type="button" onClick={refresh}>
              最新情報を再取得
            </button>
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
}
