import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// aria story app (file routes, resumed): one page per component, used by the browser tests.
// `RIVET_RESUME_MODEL=derived` (M2 gate, derived-client plan): build with `resume: { model: "derived" }` — pair it with
// its own `STORIES_DIST` (e.g. `dist-fuzz-derived`) so a serialized build is never reused.
const model = process.env.RIVET_RESUME_MODEL;
if (model !== undefined && model !== "serialized" && model !== "derived")
  throw new Error(`RIVET_RESUME_MODEL must be "serialized" or "derived" (got ${model})`);
// `RIVET_DOM_DATA=1` (DOM-DATA measurements): build with `resume: { domData: true }` — pair it with its own `STORIES_DIST`.
const domData = process.env.RIVET_DOM_DATA === "1";
export default defineConfig({
  plugins: [
    rivetRouter({
      styles: ["src/styles.css"],
      // Shell cache story (`/shell-loader`, PPR-T23): stored shell + live hole.
      routeRules: { "/shell-loader": { shell: { maxAge: 3600 } } },
      ...(model || domData ? { resume: { ...(model ? { model } : {}), ...(domData ? { domData } : {}) } } : {}),
    }),
  ],
  logLevel: "warn",
});
