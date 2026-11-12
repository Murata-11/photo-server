import { addons } from 'storybook/manager-api';

addons.setConfig({
  showPanel: false,
  layoutCustomisations: { showPanel: () => false },
});
