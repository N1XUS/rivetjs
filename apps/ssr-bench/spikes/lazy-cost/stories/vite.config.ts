import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Story harness app (`../stories.ts`): cdk story pages; `RIVET_DOM_DATA=1` (`stories.ts --dom-data`) builds with
// `resume: { domData: true }` (off by default).
const domData = process.env.RIVET_DOM_DATA === "1";
export default defineConfig({
  plugins: [
    rivetRouter({
      styles: ["../../../../../libs/cdk/tests-components/app/src/styles.css"],
      resume: { domData },
    }),
  ],
  logLevel: "warn",
});
