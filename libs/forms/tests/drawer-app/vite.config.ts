import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Drawer demo (file routes, resumed): a customer list with a "New customer" form in a cdk Modal drawer.
// `RIVET_RESUME_MODEL=derived` (M6-PARITY): the derived resume model (generated files in `.rivet-derived/`, build in `dist/derived/`).
const derived = process.env.RIVET_RESUME_MODEL === "derived";
export default defineConfig({
  plugins: [rivetRouter({ clientRouter: true, styles: ["src/styles.css"], ...(derived ? { resume: { model: "derived" }, outDir: ".rivet-derived" } : {}) })],
  logLevel: "warn",
});
