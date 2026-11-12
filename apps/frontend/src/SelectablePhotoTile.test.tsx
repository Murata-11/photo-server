// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { SelectablePhotoTile } from './SelectablePhotoTile';
import { seed } from './mocks/data';
const firstPhoto = seed[0];
if (!firstPhoto) throw new Error('写真フィクスチャがありません');
const callbacks = () => ({
  onOpen: vi.fn(),
  onToggle: vi.fn(),
  onLongPress: vi.fn(),
  onKeyboardSelect: vi.fn(),
  onPointerStart: vi.fn(),
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('PointerEvent', MouseEvent);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('丸を隠し、通常タップでは詳細を開く', () => {
  const props = callbacks();
  render(
    <SelectablePhotoTile
      photo={firstPhoto}
      selected={false}
      selecting={false}
      {...props}
    />,
  );
  expect(screen.getAllByRole('button')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button'));
  expect(props.onOpen).toHaveBeenCalledOnce();
});
it('500msの長押しで選択を開始する', () => {
  const props = callbacks();
  render(
    <SelectablePhotoTile
      photo={firstPhoto}
      selected={false}
      selecting={false}
      {...props}
    />,
  );
  fireEvent.pointerDown(screen.getByRole('button'), {
    button: 0,
    clientX: 10,
    clientY: 10,
  });
  act(() => vi.advanceTimersByTime(499));
  expect(props.onLongPress).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(props.onLongPress).toHaveBeenCalledOnce();
});
it.each(['pointerUp', 'pointerCancel', 'pointerLeave', 'pointerMove'])(
  '%sで長押しを取り消す',
  (event) => {
    const props = callbacks();
    render(
      <SelectablePhotoTile
        photo={firstPhoto}
        selected={false}
        selecting={false}
        {...props}
      />,
    );
    const button = screen.getByRole('button');
    fireEvent.pointerDown(button, { button: 0, clientX: 10, clientY: 10 });
    fireEvent[event as 'pointerUp'](button, { clientX: 30, clientY: 30 });
    act(() => vi.advanceTimersByTime(600));
    expect(props.onLongPress).not.toHaveBeenCalled();
  },
);
it('選択中は写真と丸で選択を切り替え、長押しを開始しない', () => {
  const props = callbacks();
  render(
    <SelectablePhotoTile photo={firstPhoto} selected selecting {...props} />,
  );
  const photo = screen.getByRole('button', {
    name: '湖畔の朝を選択',
  });
  const check = screen.getByRole('button', {
    name: '湖畔の朝の選択を解除',
  });
  fireEvent.pointerDown(photo, { button: 0 });
  fireEvent.click(photo);
  fireEvent.pointerDown(check, { button: 0 });
  fireEvent.click(check);
  act(() => vi.advanceTimersByTime(600));
  expect(props.onToggle).toHaveBeenCalledTimes(2);
  expect(props.onLongPress).not.toHaveBeenCalled();
  expect(props.onOpen).not.toHaveBeenCalled();
});
it('右クリックでは長押しせず、Shift+Enterで選択を開始する', () => {
  const props = callbacks();
  render(
    <SelectablePhotoTile
      photo={firstPhoto}
      selected={false}
      selecting={false}
      {...props}
    />,
  );
  const button = screen.getByRole('button');
  fireEvent.pointerDown(button, { button: 2 });
  act(() => vi.advanceTimersByTime(600));
  expect(props.onLongPress).not.toHaveBeenCalled();
  fireEvent.keyDown(button, { key: 'Enter', shiftKey: true });
  expect(props.onKeyboardSelect).toHaveBeenCalledOnce();
});
