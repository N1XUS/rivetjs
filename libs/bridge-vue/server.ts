// @rivetjs/bridge-vue/server — each island is a fresh Vue app. Async setup/Suspense resolve to completion.
import { createSSRApp, h, Suspense, type Component } from "vue";
import { renderToString, type SSRContext } from "vue/server-renderer";
import type { ServerAdapter } from "@rivetjs/bridge/adapter";
import { nativeHead } from "@rivetjs/bridge/head";
import type { VueAdapterOptions } from "./options.ts";
import { withSlots } from "./slot.ts";

export type { VueAdapterOptions } from "./options.ts";

/** Create an adapter with the same setup hook as its client counterpart. Vite wires this automatically via vue({ setup }). */
export function createAdapter(options: VueAdapterOptions = {}) {
  return {
    name: "vue",
    async render(component, props, slots, ctx) {
      const app = createSSRApp({ render: () => h(Suspense, null, { default: () => h(component, props, withSlots(Object.keys(slots))) }) });
      options.setup?.(app);
      app.config.idPrefix = ctx.id;
      // Vue may handle an async setup rejection and render a comment. Capture it even if the app installs a handler:
      // Rivet must receive the error to render the island's fallback.
      let failure: { error: unknown } | undefined;
      const report = app.config.errorHandler;
      app.config.errorHandler = (error, instance, info) => {
        failure ??= { error };
        report?.(error, instance, info);
      };
      const context: SSRContext = {};
      const html = await renderToString(app, context);
      if (failure) throw failure.error;
      const cssModules = context.modules instanceof Set ? Array.from(context.modules, String) : undefined;
      const teleports = context.teleports;
      if (!teleports || !Object.keys(teleports).length) return cssModules?.length ? { html, cssModules } : html;
      for (const target of Object.keys(teleports))
        if (target !== "head") throw new Error(`Vue island ${ctx.id}: Teleport target "${target}" is unsupported; only "head" can cross an island boundary.`);
      const { head, rest } = nativeHead("vue", ctx.id, teleports.head ?? "", ctx.nonce);
      return head || cssModules?.length ? { html: rest + html, ...(head ? { head } : {}), ...(cssModules?.length ? { cssModules } : {}) } : rest + html;
    },
  } satisfies ServerAdapter<Component>;
}

export const adapter = createAdapter();
