import { readFileSync } from 'node:fs';
import type { StorybookConfig } from '@storybook/react-vite';
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/react-vite',
  staticDirs: ['../public'],
  previewHead: (head) =>
    head +
    '<script>' +
    readFileSync(
      new URL('../src/appearance-bootstrap.js', import.meta.url),
      'utf8',
    ) +
    '</script>',
  core: { disableTelemetry: true },
  features: {
    sidebarOnboardingChecklist: false,
    menuOnboardingChecklist: false,
  },
};
export default config;
