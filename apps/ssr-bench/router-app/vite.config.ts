import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// The router lane's file-routed app. `build.ts` runs the client and SSR builds into `dist/rivet-router/`.
// Everything but the container's runtime deps (`apps/ssr-bench/runtime`) is bundled into the server build.
export default defineConfig({
  plugins: [rivetRouter()],
  logLevel: "warn",
  ssr: { noExternal: true, external: ["marked"] },
});
