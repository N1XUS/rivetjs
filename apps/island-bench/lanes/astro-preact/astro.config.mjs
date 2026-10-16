// Astro lane of apps/island-bench: per-request SSR (`output: "server"`, @astrojs/node standalone), the shared Preact
// components through @astrojs/preact with Astro's own client directives (load / idle / visible; the badge static).
// `dedupe`: the shared components live outside this lane, so `preact` resolves from here (one Preact 10 copy).
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import preact from "@astrojs/preact";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [preact()],
  server: { host: "127.0.0.1" },
  vite: { resolve: { dedupe: ["preact"] } },
  telemetry: false,
});
