// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SwipePhotoStage } from './SwipePhotoStage';
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  isPrimary: boolean;
  constructor(type: string, init: PointerEventInit) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.isPrimary = init.isPrimary ?? true;
  }
}
beforeEach(() => vi.stubGlobal('PointerEvent', TestPointerEvent));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each([
  [-100, 0, 'next'],
  [100, 0, 'previous'],
  [20, 0, 'none'],
  [90, 100, 'none'],
])('横移動%s・縦移動%sでは%s', (dx, dy, target) => {
  const onNext = vi.fn(),
    onPrevious = vi.fn();
  render(
    <SwipePhotoStage
      src="photo.jpg"
      name="写真"
      onNext={onNext}
      onPrevious={onPrevious}
    />,
  );
  const stage = screen.getByRole('group');
  fireEvent.pointerDown(stage, { button: 0, clientX: 200, clientY: 100 });
  fireEvent.pointerUp(stage, { clientX: 200 + dx, clientY: 100 + dy });
  expect(onNext).toHaveBeenCalledTimes(target === 'next' ? 1 : 0);
  expect(onPrevious).toHaveBeenCalledTimes(target === 'previous' ? 1 : 0);
});
it.each(['pointerCancel', 'lostPointerCapture'])(
  '%sでは写真を移動しない',
  (event) => {
    const onNext = vi.fn();
    render(<SwipePhotoStage src="photo.jpg" name="写真" onNext={onNext} />);
    const stage = screen.getByRole('group');
    fireEvent.pointerDown(stage, { button: 0, clientX: 200, clientY: 100 });
    fireEvent[event as 'pointerCancel'](stage);
    fireEvent.pointerUp(stage, { clientX: 0, clientY: 100 });
    expect(onNext).not.toHaveBeenCalled();
  },
);
it('複数指・別ポインター・右ボタンでは移動しない', () => {
  const onNext = vi.fn();
  render(<SwipePhotoStage src="photo.jpg" name="写真" onNext={onNext} />);
  const stage = screen.getByRole('group');
  fireEvent.pointerDown(stage, { button: 0, pointerId: 1, clientX: 200 });
  fireEvent.pointerDown(stage, { button: 0, pointerId: 2, isPrimary: false });
  fireEvent.pointerUp(stage, { pointerId: 1, clientX: 0 });
  fireEvent.pointerDown(stage, { button: 0, pointerId: 1, clientX: 200 });
  fireEvent.pointerUp(stage, { pointerId: 2, clientX: 0 });
  fireEvent.pointerDown(stage, { button: 2, clientX: 200 });
  fireEvent.pointerUp(stage, { clientX: 0 });
  expect(onNext).not.toHaveBeenCalled();
});
it('先頭・末尾では折り返さず、画像の代替テキストを保つ', () => {
  render(<SwipePhotoStage src="photo.jpg" name="湖畔" />);
  const stage = screen.getByRole('group');
  fireEvent.pointerDown(stage, { button: 0, clientX: 200 });
  fireEvent.pointerUp(stage, { clientX: 0 });
  fireEvent.pointerDown(stage, { button: 0, clientX: 0 });
  fireEvent.pointerUp(stage, { clientX: 200 });
  expect(screen.getByRole('img', { name: '湖畔' })).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});
