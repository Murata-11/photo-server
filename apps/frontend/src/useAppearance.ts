import { useSyncExternalStore } from 'react';
import type { Appearance } from './AppearanceSettings';
import './appearance-bootstrap.js';

type AppearanceState = {
  value: Appearance;
  resolved: 'light' | 'dark';
  storageUnavailable: boolean;
};
declare global {
  interface Window {
    hiyoriAppearance: {
      getSnapshot: () => AppearanceState;
      subscribe: (subscriber: () => void) => () => void;
      setValue: (value: Appearance) => void;
    };
  }
}
export function useAppearance() {
  const controller = window.hiyoriAppearance;
  return {
    ...useSyncExternalStore(controller.subscribe, controller.getSnapshot),
    setValue: controller.setValue,
  };
}
