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

export function BulkTrashDialog({
  open,
  onOpenChange,
  photoIds,
  album,
  onSaved,
  onReload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoIds: string[];
  album?: string;
  onSaved: (photoIds: string[]) => void;
  onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!open) {
      setError('');
      setSaved(false);
    }
  }, [open]);
  function close(next: boolean) {
    if (!lock.current) onOpenChange(next);
  }
  async function submit() {
    if (lock.current || (!saved && (!photoIds.length || photoIds.length > 100)))
      return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (!saved) {
        await api.trashPhotos({ photoIds });
        setSaved(true);
        onSaved(photoIds);
        toast.success(`${photoIds.length}枚の写真をゴミ箱に移動しました`);
      }
      try {
        await onReload();
        onOpenChange(false);
      } catch {
        setError(
          'ゴミ箱への移動は完了しました。一覧を更新できませんでした。再取得してください。',
        );
      }
    } catch (e) {
      setError(
        `移動を確認できませんでした。通信が途切れた場合は結果が不明です。同じ対象を安全に再試行できます。${(e as Error).message}`,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        closeDisabled={busy}
        className="max-h-[90dvh] overflow-y-auto"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById('bulk-trash-cancel')?.focus();
        }}
      >
        <DialogTitle className="dialog-title">
          {saved
            ? 'ゴミ箱への移動が完了しました'
            : `${photoIds.length}枚をゴミ箱に移動しますか？`}
        </DialogTitle>
        <DialogDescription className="dialog-description">
          {saved
            ? '写真はゴミ箱から復元できます。'
            : '選択した写真をふたりの共有ライブラリ全体でゴミ箱に移動します。元の写真とアルバム所属は保持され、ゴミ箱から1枚ずつ復元できます。'}
        </DialogDescription>
        {!saved && album && (
          <p className="bulk-trash-note">
            「{album}
            」からの所属解除ではありません。他のアルバムからも非表示になります。
          </p>
        )}
        {!saved && photoIds.length > 100 && (
          <p role="alert">
            一度に移動できるのは100枚までです。選択を減らしてください。
          </p>
        )}
        {error && (
          <p role="alert" className="bulk-album-error">
            {error}
          </p>
        )}
        {busy && (
          <p role="status">
            {saved ? '一覧を更新しています…' : 'ゴミ箱に移動しています…'}
          </p>
        )}
        <div className="bulk-album-actions">
          <Button
            id="bulk-trash-cancel"
            variant="ghost"
            disabled={busy}
            onClick={() => close(false)}
          >
            {saved ? '閉じる' : 'キャンセル'}
          </Button>
          <Button
            variant={saved ? 'default' : 'destructive'}
            disabled={
              busy || (!saved && (!photoIds.length || photoIds.length > 100))
            }
            onClick={submit}
          >
            {saved ? '再取得' : error ? '同じ対象を再試行' : 'ゴミ箱に移動'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
