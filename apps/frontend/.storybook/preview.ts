import { initialize, mswLoader } from 'msw-storybook-addon';
import { handlers } from '../src/mocks/handlers';
import '../src/index.css';
initialize({
  onUnhandledRequest: 'bypass',
  serviceWorker: { url: './mockServiceWorker.js', options: { scope: './' } },
});
export default {
  parameters: { layout: 'fullscreen', msw: { handlers } },
  loaders: [mswLoader],
};
