import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from './components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './components/ui/dialog';

type Photo = { name: string; originalUrl: string };

export function SavePhotoButton({ photo }: { photo: Photo }) {
  const [open, setOpen] = useState(false);
  const supported =
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function';
  if (!supported)
    return (
      <Button variant="ghost" size="icon" aria-label="ダウンロード" asChild>
        <a href={photo.originalUrl} download={photo.name}>
          <Download size={20} />
        </a>
      </Button>
    );
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="写真に保存"
        title="写真に保存"
        onClick={() => setOpen(true)}
      >
        <Download size={20} />
      </Button>
      {open && <SavePhotoDialog photo={photo} onClose={() => setOpen(false)} />}
    </>
  );
}

function SavePhotoDialog({
  photo,
  onClose,
}: {
  photo: Photo;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File>();
  const [message, setMessage] = useState('元画像を準備しています…');
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setFile(undefined);
    setFailed(false);
    setMessage('元画像を準備しています…');
    void (async () => {
      try {
        const response = await fetch(photo.originalUrl, {
          signal: controller.signal,
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error('fetch failed');
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        const original = new File([blob], photo.name, { type: blob.type });
        if (!navigator.canShare({ files: [original] })) {
          setMessage(
            'この写真は共有できません。ダウンロードをご利用ください。',
          );
          return;
        }
        setFile(original);
        setMessage(
          '準備ができました。共有画面から「画像を保存」を選んでください。',
        );
      } catch {
        if (controller.signal.aborted) return;
        setFailed(true);
        setMessage('元画像を取得できませんでした。再試行できます。');
      }
    })();
    return () => controller.abort();
  }, [photo.originalUrl, photo.name, attempt]);

  async function share() {
    if (!file || sharing) return;
    setSharing(true);
    try {
      // Call directly in the click handler, before any await, to retain user activation.
      await navigator.share({ files: [file] });
      setMessage(
        '共有画面を閉じました。写真アプリで保存結果をご確認ください。',
      );
    } catch (error) {
      setMessage(
        error !== null &&
          typeof error === 'object' &&
          'name' in error &&
          error.name === 'AbortError'
          ? '共有をキャンセルしました。もう一度開くことができます。'
          : '共有画面を開けませんでした。再試行するか、ダウンロードをご利用ください。',
      );
    } finally {
      setSharing(false);
    }
  }

  return (
    <Dialog open onOpenChange={(value) => !value && !sharing && onClose()}>
      <DialogContent closeDisabled={sharing}>
        <DialogTitle className="mb-3 text-lg font-bold">写真に保存</DialogTitle>
        <DialogDescription>
          iPhoneでは共有画面の「画像を保存」から写真アプリに保存できます。
        </DialogDescription>
        <p role="status" className="my-4 text-sm">
          {message}
        </p>
        <div className="flex flex-wrap gap-3">
          {file && (
            <Button onClick={() => void share()} disabled={sharing}>
              共有画面を開く
            </Button>
          )}
          {failed && (
            <Button onClick={() => setAttempt((value) => value + 1)}>
              再試行
            </Button>
          )}
          {!sharing && (
            <Button variant="outline" asChild>
              <a href={photo.originalUrl} download={photo.name}>
                ダウンロード
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
