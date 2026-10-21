import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// LAZY-COST-2 harness app (`../stories.ts`): cdk story pages built with `resume: { lazyRows: true }` (+ `domData` when
// `RIVET_DOM_DATA=1`); the runtime switch `RIVET_LAZY_ROWS=on` picks lazy vs recorded rows per render.
// LAZY-FLIP (`../client.ts`): `RIVET_LAZY_BUILD=0` builds without `lazyRows`. Both options are passed explicitly, so the
// builds stay the same whatever the plugin defaults are.
const domData = process.env.RIVET_DOM_DATA === "1";
const lazyRows = process.env.RIVET_LAZY_BUILD !== "0";
export default defineConfig({
  plugins: [
    rivetRouter({
      styles: ["../../../../../libs/cdk/tests-components/app/src/styles.css"],
      resume: { lazyRows, domData },
    }),
  ],
  logLevel: "warn",
});
