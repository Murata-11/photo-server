import { initialize, mswLoader } from "msw-storybook-addon";
import { handlers } from "../src/mocks/handlers";
import "../src/index.css";
initialize({ onUnhandledRequest: "bypass" });
export default {
  parameters: { layout: "fullscreen", msw: { handlers } },
  loaders: [mswLoader],
};
