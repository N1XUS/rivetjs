import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// LAZY-COST-2 harness app (`../stories.ts`): cdk story pages built with `resume: { lazyRows: true }` (+ `domData` when
// `RIVET_DOM_DATA=1`); the server env `RIVET_LAZY_ROWS` (`on` / `off`) picks lazy vs recorded rows per render.
// LAZY-FLIP (`../client.ts`): `RIVET_LAZY_BUILD=0` builds without `lazyRows`. Both options are passed explicitly, so the
// builds stay the same whatever the plugin defaults are (both default true since LAZY-FLIP 2026-10-22; `RIVET_LAZY_BUILD=0`
// without `RIVET_DOM_DATA=1` = the opt-out build, the reports' `default` column).
// LAZY-VS-DERIVED: `RIVET_RESUME_MODEL=derived` builds with `resume: { model: "derived" }` (`lazyRows` / `domData` do not
// apply to that model and are not passed).
const domData = process.env.RIVET_DOM_DATA === "1";
const lazyRows = process.env.RIVET_LAZY_BUILD !== "0";
const model = process.env.RIVET_RESUME_MODEL;
if (model !== undefined && model !== "serialized" && model !== "derived")
  throw new Error(`RIVET_RESUME_MODEL must be "serialized" or "derived" (got ${model})`);
export default defineConfig({
  plugins: [
    rivetRouter({
      styles: ["../../../../../libs/cdk/tests-components/app/src/styles.css"],
      resume: model === "derived" ? { model } : { lazyRows, domData },
    }),
  ],
  logLevel: "warn",
});
