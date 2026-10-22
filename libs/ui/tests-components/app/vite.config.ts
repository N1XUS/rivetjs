import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

// ui story app (file routes, resumed): one page per HeroUI component, used by the browser tests. Components outside `src/routes`
// resume through rivetRouter's `resume.appModules` (default true); no `resume.modules` list. `images`: the `?image`
// imports of visual-matrix demos (theme-swap). Lazy rows + DOM-DATA
// are on by default (`resume.lazyRows` / `resume.domData`, LAZY-FLIP 2026-10-22).
export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], images: true }), tailwindcss()],
  logLevel: "warn",
});
