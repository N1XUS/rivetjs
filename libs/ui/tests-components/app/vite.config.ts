import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

// ui story app (file routes, resumed): one page per HeroUI component, used by the browser tests. Components outside `src/routes`
// resume through rivetRouter's `resume.appModules` (default true); no `resume.modules` list. `images`: the `?image`
// imports of visual-matrix demos (theme-swap). `RIVET_DOM_DATA=1` (LAZY-FLIP fuzz builds): `resume: { domData: true }` — pair it
// with its own `STORIES_DIST`.
const domData = process.env.RIVET_DOM_DATA === "1";
export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], images: true, ...(domData ? { resume: { domData } } : {}) }), tailwindcss()],
  logLevel: "warn",
});
