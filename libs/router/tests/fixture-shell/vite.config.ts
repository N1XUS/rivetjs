import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Shell rules: every page stores its shell; `/search` and `/context` key only the `page` parameter. `RIVET_RESUME_MODEL=derived`
// (DERIVED-C3): the derived resume model (generated files in `.rivet-derived/`; the tests build into `dist/derived`).
const derived = process.env.RIVET_RESUME_MODEL === "derived";
export default defineConfig({
  plugins: [
    rivetRouter({
      ...(derived ? { resume: { model: "derived" as const }, outDir: ".rivet-derived" } : {}),
      routeRules: {
        "/**": { shell: true },
        "/gate": { shell: false },
        "/search": { shell: { query: ["page"] } },
        "/context": { shell: { query: ["page"] } },
      },
    }),
  ],
  logLevel: "warn",
});
