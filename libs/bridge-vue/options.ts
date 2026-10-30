import type { App } from "vue";

/** App customisation shared by the server and client adapter factories. */
export interface VueAdapterOptions {
  /** Runs once for each island app, before rendering/mounting. Install Pinia, i18n, plugins and providers here. */
  setup?(app: App): void;
}
