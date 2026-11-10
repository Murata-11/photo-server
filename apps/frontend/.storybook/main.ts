import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
  framework: '@storybook/html-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  core: { disableTelemetry: true },
};

export default config;
