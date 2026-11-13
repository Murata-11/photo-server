import { useRef, useState } from 'react';
import { api } from './lib/api';
import { Button } from './components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './components/ui/dialog';

export function DeleteAlbumDialog({
  name,
  onClose,
  onDeleted,
  onReload,
}: {
  name: string;
  onClose: () => void;
  onDeleted: () => void;
  onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function reload() {
    try {
      await onReload();
      onClose();
    } catch {
      setError(
        'アルバムの削除は完了しました。一覧を更新できませんでした。再取得してください。',
      );
    }
  }
  async function complete() {
    setSaved(true);
    setUnknown(false);
    onDeleted();
    await reload();
  }
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (saved) await reload();
      else if (unknown) {
        const albums = await api.albums();
        if (!albums.includes(name)) await complete();
        else {
          setUnknown(false);
          setError(
            '現在この名前のアルバムが存在します。同じ名前で作り直された可能性もあります。対象を確認してから削除してください。',
          );
        }
      } else {
        await api.deleteAlbum(name);
        await complete();
      }
    } catch (error) {
      if (!saved) setUnknown(true);
      setError(
        `削除結果を確認できませんでした。通信が途切れた場合は結果が不明です。まず現在の状態を確認してください。${(error as Error).message}`,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !lock.current) onClose();
      }}
    >
      <DialogContent
        closeDisabled={busy}
        className="delete-album-dialog max-h-[90dvh] overflow-y-auto"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById('delete-album-cancel')?.focus();
        }}
      >
        <DialogTitle className="dialog-title">
          {saved ? 'アルバムを削除しました' : 'アルバムを削除しますか？'}
        </DialogTitle>
        <DialogDescription className="dialog-description">
          {saved
            ? '写真と他のアルバムへの所属は保持されています。'
            : 'アルバムだけを削除します。写真は削除されません。他のアルバムへの所属も保持されます。削除したアルバムは復元できません。'}
        </DialogDescription>
        <p className="delete-album-name">「{name}」</p>
        {error && (
          <p role="alert" className="bulk-album-error delete-album-error">
            {error}
          </p>
        )}
        {busy && (
          <p role="status">
            {saved
              ? '一覧を更新しています…'
              : unknown
                ? '削除結果を確認しています…'
                : 'アルバムを削除しています…'}
          </p>
        )}
        <div className="bulk-album-actions delete-album-actions">
          <Button
            id="delete-album-cancel"
            variant="ghost"
            disabled={busy}
            onClick={onClose}
          >
            {saved || unknown ? '閉じる' : 'キャンセル'}
          </Button>
          <Button
            variant={saved || unknown ? 'default' : 'destructive'}
            disabled={busy}
            onClick={submit}
          >
            {saved
              ? '再取得'
              : unknown
                ? '削除結果を確認'
                : 'このアルバムを削除'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
