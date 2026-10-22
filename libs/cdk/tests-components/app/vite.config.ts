import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// aria story app (file routes, resumed): one page per component, used by the browser tests.
// `RIVET_RESUME_MODEL=derived` (M2 gate, derived-client plan): build with `resume: { model: "derived" }` — pair it with
// its own `STORIES_DIST` (e.g. `dist-fuzz-derived`) so a serialized build is never reused.
const model = process.env.RIVET_RESUME_MODEL;
if (model !== undefined && model !== "serialized" && model !== "derived")
  throw new Error(`RIVET_RESUME_MODEL must be "serialized" or "derived" (got ${model})`);
// `resume.lazyRows` / `resume.domData` are on by default (LAZY-FLIP 2026-10-22): the story builds are lazy rows + DOM-DATA builds.
export default defineConfig({
  plugins: [
    rivetRouter({
      clientRouter: true,
      styles: ["src/styles.css"],
      // Shell cache stories (PPR-T23 / T6 / T57): stored shell + live hole; `/shell-loader` H-holes, `/shell-replay` replays,
      // `/shell-provider` replays (its hole writes a signal an ancestor provides).
      routeRules: {
        "/shell-loader": { shell: { maxAge: 3600 } },
        "/shell-replay": { shell: { maxAge: 3600 } },
        "/shell-provider": { shell: { maxAge: 3600 } },
      },
      ...(model ? { resume: { model } } : {}),
    }),
  ],
  logLevel: "warn",
});
