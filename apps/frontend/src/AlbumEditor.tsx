import { useState } from 'react';
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
  names,
  onPhotos,
  onClose,
}: {
  photo: Photo;
  names: string[];
  onPhotos: (photos: Photo[]) => void;
  onClose: () => void;
}) {
  const [baseline, setBaseline] = useState(photo.albums);
  const [chosen, setChosen] = useState(photo.albums);
  const [query, setQuery] = useState('');
  const [onlyMember, setOnlyMember] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  // Freeze order for this editing session, including while searching or saving.
  const [ordered] = useState(() =>
    [...names].sort(
      (a, b) =>
        Number(photo.albums.includes(b)) - Number(photo.albums.includes(a)) ||
        a.localeCompare(b, 'ja'),
    ),
  );
  const added = chosen.filter((n) => !baseline.includes(n));
  const removed = baseline.filter((n) => !chosen.includes(n));
  const dirty = added.length + removed.length > 0;
  function close() {
    if (saving) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  async function save() {
    setSaving(true);
    setError('');
    const succeeded: string[] = [],
      failed: string[] = [];
    let next = [...baseline];
    for (const [name, adding] of [
      ...added.map((n) => [n, true] as const),
      ...removed.map((n) => [n, false] as const),
    ]) {
      try {
        await (adding ? api.addAlbum : api.removeAlbum)(photo.id, name);
        next = adding
          ? [...new Set([...next, name])]
          : next.filter((n) => n !== name);
        succeeded.push(name);
      } catch {
        failed.push(name);
      }
    }
    setBaseline(next);
    try {
      onPhotos(await api.list());
      setNeedsRefresh(false);
      if (!failed.length) {
        onClose();
        return;
      }
    } catch {
      setNeedsRefresh(true);
    }
    setError(
      failed.length
        ? `${succeeded.length}件保存済み。${failed.length}件を保存・確認できませんでした：${failed.join('、')}。失敗分を再試行できます。`
        : '変更は保存しましたが、最新情報を取得できませんでした。再取得してください。',
    );
    setSaving(false);
  }
  const visible = ordered.filter(
    (n) =>
      (!onlyMember || chosen.includes(n)) &&
      n.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="album-editor"
        closeDisabled={saving}
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
          close();
        }}
        onPointerDownOutside={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <header className="album-editor-header">
          <DialogTitle className="dialog-title">アルバムを編集</DialogTitle>
          <DialogDescription>
            この写真の所属を選び、変更を保存してください。
          </DialogDescription>
          <div className="album-editor-photo">
            <img src={photo.src} alt="" />
            <span>{photo.name}</span>
          </div>
          <label>
            アルバムを検索
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={saving}
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
              disabled={saving}
            >
              すべて
            </button>
            <button
              type="button"
              aria-pressed={onlyMember}
              onClick={() => setOnlyMember(true)}
              disabled={saving}
            >
              所属中
            </button>
            <span>{chosen.length}件に所属</span>
          </div>
        </header>
        <fieldset
          className="album-editor-list"
          disabled={saving}
          aria-busy={saving}
        >
          <legend className="sr-only">所属アルバム</legend>
          {!names.length ? (
            <p>アルバムを作成すると追加できます。</p>
          ) : !visible.length ? (
            <p>該当するアルバムがありません</p>
          ) : (
            visible.map((name) => (
              <label key={name}>
                <input
                  type="checkbox"
                  checked={chosen.includes(name)}
                  onChange={(e) =>
                    setChosen((prev) =>
                      e.target.checked
                        ? [...prev, name]
                        : prev.filter((n) => n !== name),
                    )
                  }
                />
                <span>{name}</span>
              </label>
            ))
          )}
        </fieldset>
        <footer className="album-editor-footer">
          {error && <p role="alert">{error}</p>}
          {saving ? (
            <p role="status">所属を保存しています</p>
          ) : (
            <p>
              {added.length}件追加・{removed.length}件解除
            </p>
          )}
          {discard ? (
            <div>
              <p>未保存の変更を破棄しますか？</p>
              <button type="button" onClick={() => setDiscard(false)}>
                編集を続ける
              </button>
              <button type="button" onClick={onClose}>
                変更を破棄
              </button>
            </div>
          ) : (
            <div>
              <button type="button" onClick={close} disabled={saving}>
                キャンセル
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || (!dirty && !needsRefresh)}
              >
                {needsRefresh && !dirty
                  ? '最新情報を再取得'
                  : error
                    ? '失敗分を再試行'
                    : '変更を保存'}
              </button>
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
