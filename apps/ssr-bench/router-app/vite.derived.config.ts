import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// rivet-derived lane: the same file-routed app as `vite.config.ts`, resumed with the derived model
// (`resume.model: "derived"`, derived-client plan M2). `build.ts` runs its client and SSR builds into
// `dist/rivet-derived/`; `server-derived.ts` serves them. Codegen goes to its own `.rivet-derived/`
// so the two builds never share generated files.
export default defineConfig({
  plugins: [rivetRouter({ outDir: ".rivet-derived", resume: { model: "derived" } })],
  logLevel: "warn",
  ssr: { noExternal: true, external: ["marked"] },
});
