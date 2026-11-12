import { originalPreviewUrl } from './lib/photos';
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
  const previewUrl = originalPreviewUrl(photo.originalUrl);
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
          詳細画面の画像は元画像です。iPhoneでは画像を長押しして保存をお試しください。別タブで開く場合は「元画像をプレビュー」からSafariの共有ボタンや画像の長押しをお試しください。
        </DialogDescription>
        <p className="my-4 text-sm">
          保存項目が出ない場合はダウンロードをご利用ください。PCではダウンロード、またはプレビューした画像の右クリックから保存できます。
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
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
