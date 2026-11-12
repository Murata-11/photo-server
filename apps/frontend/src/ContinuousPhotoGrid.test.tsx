// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { ContinuousPhotoGrid } from './ContinuousPhotoGrid';

let gridTop = -100;
let gridBottom = 1000;
let rowBottom = 150;
let queued: FrameRequestCallback | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
  gridTop = -100;
  gridBottom = 1000;
  rowBottom = 150;
  queued = undefined;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return {
        top: this.classList.contains('continuous-photo-grid') ? gridTop : 0,
        bottom: this.classList.contains('continuous-photo-grid')
          ? gridBottom
          : rowBottom,
      } as DOMRect;
    },
  );
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    queued = callback;
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function show(date?: string) {
  return render(
    <ContinuousPhotoGrid>
      <div data-uploaded-at={date} />
    </ContinuousPhotoGrid>,
  );
}
function flushScroll() {
  fireEvent.scroll(window);
  act(() => {
    queued?.(0);
  });
}
it.each([
  ['2026-11-12T12:00:00Z', '今週'],
  ['2026-11-08T23:59:59Z', '11月2日〜8日'],
  ['2026-10-01T00:00:00Z', '9月28日〜10月4日'],
  ['2025-12-31T00:00:00Z', '2025年12月29日〜2026年1月4日'],
  ['invalid', 'アップロード日不明'],
])('アップロード日時 %s の週を表示する', (date, text) => {
  show(date);
  expect(screen.getByLabelText('アップロード期間（UTC）').textContent).toBe(
    text,
  );
});
it('先頭では隠し、スクロールとリサイズで表示を更新する', () => {
  gridTop = 84;
  const { rerender } = show('2026-11-08T12:00:00Z');
  const badge = screen.getByLabelText('アップロード期間（UTC）');
  expect(badge.hidden).toBe(true);
  gridTop = -100;
  flushScroll();
  expect(badge.hidden).toBe(false);
  rerender(
    <ContinuousPhotoGrid>
      <div data-uploaded-at="2026-10-25T00:00:00Z" />
    </ContinuousPhotoGrid>,
  );
  fireEvent.resize(window);
  act(() => {
    queued?.(0);
  });
  expect(badge.textContent).toBe('10月19日〜25日');
  gridBottom = 50;
  flushScroll();
  expect(badge.hidden).toBe(true);
});
it('見える写真がないときは期間を表示しない', () => {
  rowBottom = 50;
  show('2026-11-08T00:00:00Z');
  expect(screen.getByLabelText('アップロード期間（UTC）').hidden).toBe(true);
});
it('連続したスクロール処理をまとめ、画面を離れると予約処理を解除する', () => {
  const { unmount } = show();
  fireEvent.scroll(window);
  fireEvent.scroll(window);
  expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
  unmount();
  expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
});
