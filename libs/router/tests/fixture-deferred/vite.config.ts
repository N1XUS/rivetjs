import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// `RIVET_RESUME_MODEL=derived` (DERIVED-C3): the derived resume model (generated files in `.rivet-derived/`; the tests build
// into `dist/derived`).
const derived = process.env.RIVET_RESUME_MODEL === "derived";
export default defineConfig({
  plugins: [rivetRouter(derived ? { resume: { model: "derived" }, outDir: ".rivet-derived" } : {})],
  logLevel: "warn",
});
