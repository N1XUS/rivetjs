// Astro lane of apps/island-bench: per-request SSR (`output: "server"`, @astrojs/node standalone), the shared React
// components through @astrojs/react with Astro's own client directives (load / idle / visible; the badge static).
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  server: { host: "127.0.0.1" },
  telemetry: false,
});
