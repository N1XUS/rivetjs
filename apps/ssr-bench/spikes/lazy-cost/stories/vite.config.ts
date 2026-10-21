import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// LAZY-COST-2 harness app (`../stories.ts`): cdk story pages built with `resume: { lazyRows: true }` (+ `domData` when
// `RIVET_DOM_DATA=1`); the runtime switch `RIVET_LAZY_ROWS=on` picks lazy vs recorded rows per render.
const domData = process.env.RIVET_DOM_DATA === "1";
export default defineConfig({
  plugins: [rivetRouter({ resume: { lazyRows: true, ...(domData ? { domData } : {}) } })],
  logLevel: "warn",
});
