import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// PPR-T01 T0 harness app (`../bench.ts`): the rivet-dynamic article page (lane `src/content.ts` + `Markdown`) in server mode,
// in three shapes — `/full/…` (signed in: session-cookie loader + user menu), `/stub/…` (same page, the user menu = a
// constant placeholder of the same markup, no request read), `/hole/<slug>` (the user menu alone) — plus `/floor`, and
// `/shell/…` (PPR-T23: the `full` page under the `shell` route rule; the user menu = a deferred hole; `query: false`: a
// URL with a query string renders without the store = bench lane `deferred`); `/fullc/…` + `/shellc/…` (PPR-T3B): the
// same two with the article loader memoised (cached-loader variant: loaders cost ~0).
export default defineConfig({
  plugins: [
    rivetRouter({
      mode: "server",
      routeRules: { "/shell/**": { shell: { maxAge: 3600, query: false } }, "/shellc/**": { shell: { maxAge: 3600, query: false } } },
    }),
  ],
  logLevel: "warn",
});
