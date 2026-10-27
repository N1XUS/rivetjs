import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Story harness app (`../stories.ts`): cdk story pages; `RIVET_DOM_DATA=0` (`stories.ts --no-dom-data`) builds with
// `resume: { domData: false }` (on by default since DOMDATA-DEFAULT 2026-10-27).
const domData = process.env.RIVET_DOM_DATA !== "0";
export default defineConfig({
  plugins: [
    rivetRouter({
      styles: ["../../../../../libs/cdk/tests-components/app/src/styles.css"],
      resume: { domData },
    }),
  ],
  logLevel: "warn",
});
