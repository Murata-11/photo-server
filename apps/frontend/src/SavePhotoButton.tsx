import { useState } from 'react';
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
  const previewUrl = new URL(photo.originalUrl, window.location.href);
  previewUrl.searchParams.set('disposition', 'inline');
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="写真に保存"
        title="写真に保存"
        onClick={() => setOpen(true)}
      >
        <Download size={20} />
      </Button>
      <DialogContent>
        <DialogTitle className="dialog-title mb-3 text-lg font-bold">
          写真に保存
        </DialogTitle>
        <DialogDescription className="dialog-description">
          元画像を新しいタブでプレビューします。iPhoneではSafariの共有ボタン、または画像を長押しして保存してください。
        </DialogDescription>
        <p className="my-4 text-sm">
          保存項目が出ない場合はダウンロードをご利用ください。PCではダウンロード、またはプレビューした画像の右クリックから保存できます。
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a href={previewUrl.href} target="_blank" rel="noopener noreferrer">
              元画像をプレビュー
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={photo.originalUrl} download={photo.name}>
              ダウンロード
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
