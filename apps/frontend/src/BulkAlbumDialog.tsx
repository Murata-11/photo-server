import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from './lib/api';
import { Button } from './components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './components/ui/dialog';

export function BulkAlbumDialog({
  open,
  onOpenChange,
  photoIds,
  albums,
  onSaved,
  onReload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoIds: string[];
  albums: string[];
  onSaved: () => void;
  onReload: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!open) {
      setName('');
      setError('');
      setSaved(false);
    }
  }, [open]);
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (!saved) {
        await api.addPhotosAlbum({ photoIds, name });
        setSaved(true);
        onSaved();
        toast.success('アルバムに追加しました');
      }
      try {
        await onReload();
        onOpenChange(false);
      } catch {
        setError(
          '追加は完了しました。一覧を更新できませんでした。再取得してください。',
        );
      }
    } catch (e) {
      setError(
        `追加を確認できませんでした。通信が途切れた場合は結果が不明です。同じ操作を安全に再試行できます。${(e as Error).message}`,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (lock.current) return;
        onOpenChange(next);
        if (!next) {
          setName('');
          setError('');
          setSaved(false);
        }
      }}
    >
      <DialogContent
        closeDisabled={busy}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <DialogTitle className="dialog-title">アルバムに追加</DialogTitle>
        <DialogDescription className="dialog-description">
          {saved
            ? '写真の追加は完了しています。'
            : `${photoIds.length}枚の写真を既存のアルバムへ追加します。現在の所属は維持されます。`}
        </DialogDescription>
        {!saved &&
          (albums.length ? (
            <label className="bulk-album-label">
              追加先
              <select
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              >
                <option value="">アルバムを選択</option>
                {albums.map((album) => (
                  <option key={album} value={album}>
                    {album}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>
              アルバムがありません。アルバム画面で作成してから追加してください。
            </p>
          ))}
        {!saved && photoIds.length > 100 && (
          <p role="alert">
            一度に追加できるのは100枚までです。選択を減らしてください。
          </p>
        )}
        {error && (
          <p role="alert" className="bulk-album-error">
            {error}
          </p>
        )}
        {busy && (
          <p role="status">
            {saved ? '一覧を更新しています…' : 'アルバムに追加しています…'}
          </p>
        )}
        <div className="bulk-album-actions">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {saved ? '閉じる' : 'キャンセル'}
          </Button>
          <Button
            disabled={
              busy ||
              (!saved &&
                (!albums.includes(name) ||
                  !photoIds.length ||
                  photoIds.length > 100))
            }
            onClick={submit}
          >
            {saved ? '再取得' : error ? '再試行' : '追加'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
