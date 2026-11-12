import type { Preview } from '@storybook/react-vite';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { handlers } from '../src/mocks/handlers';
import '../src/index.css';
initialize({
  onUnhandledRequest: 'bypass',
  serviceWorker: { url: './mockServiceWorker.js', options: { scope: './' } },
});
const preview = {
  parameters: { layout: 'fullscreen', msw: { handlers } },
  loaders: [mswLoader],
} satisfies Preview;
export default preview;
