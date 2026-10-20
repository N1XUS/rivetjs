import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// aria story app (file routes, resumed): one page per component, used by the browser tests.
// `RIVET_RESUME_MODEL=derived` (M2 gate, derived-client plan): build with `resume: { model: "derived" }` — pair it with
// its own `STORIES_DIST` (e.g. `dist-fuzz-derived`) so a serialized build is never reused.
const model = process.env.RIVET_RESUME_MODEL;
if (model !== undefined && model !== "serialized" && model !== "derived")
  throw new Error(`RIVET_RESUME_MODEL must be "serialized" or "derived" (got ${model})`);
export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], ...(model ? { resume: { model } } : {}) })],
  logLevel: "warn",
});
