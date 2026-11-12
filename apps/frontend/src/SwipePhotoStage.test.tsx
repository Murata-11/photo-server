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

it('タップで矢印を切り替え、画像を作り直さず矢印ボタンで移動する', () => {
  const onNext = vi.fn(),
    onArrowsChange = vi.fn();
  render(
    <SwipePhotoStage
      src="photo.jpg"
      name="湖畔"
      onNext={onNext}
      onArrowsChange={onArrowsChange}
    />,
  );
  const stage = screen.getByRole('group');
  const image = screen.getByRole('img');
  fireEvent.pointerDown(stage, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(stage, { clientX: 100, clientY: 100 });
  const next = screen.getByRole('button', { name: '次の写真' });
  expect(
    screen.getByRole('button', { name: '前の写真' }).hasAttribute('disabled'),
  ).toBe(true);
  fireEvent.pointerDown(next, { button: 0 });
  fireEvent.pointerUp(next);
  fireEvent.click(next);
  expect(onNext).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: '次の写真' })).toBe(next);
  expect(screen.getByRole('img')).toBe(image);
  fireEvent.pointerDown(stage, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(stage, { clientX: 100, clientY: 100 });
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByRole('img')).toBe(image);
  expect(onArrowsChange.mock.calls).toEqual([[true], [false]]);
});
it('移動して戻したジェスチャーをタップと誤判定しない', () => {
  render(<SwipePhotoStage src="photo.jpg" name="湖畔" />);
  const stage = screen.getByRole('group');
  fireEvent.pointerDown(stage, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(stage, { clientX: 200, clientY: 100 });
  fireEvent.pointerUp(stage, { clientX: 100, clientY: 100 });
  expect(screen.queryByRole('button')).toBeNull();
});
it('EnterとSpaceで矢印を表示・非表示にできる', () => {
  render(<SwipePhotoStage src="photo.jpg" name="湖畔" />);
  const stage = screen.getByRole('group');
  fireEvent.keyDown(stage, { key: 'Enter' });
  expect(screen.getAllByRole('button')).toHaveLength(2);
  fireEvent.keyDown(stage, { key: ' ' });
  expect(screen.queryByRole('button')).toBeNull();
});
