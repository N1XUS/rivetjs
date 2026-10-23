import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

// ui story app (file routes, resumed): one page per HeroUI component, used by the browser tests. Components outside `src/routes`
// resume through rivetRouter's `resume.appModules` (default true); no `resume.modules` list. `images`: the `?image`
// imports of visual-matrix demos (theme-swap). Derived build (the only resume model since M6).
export default defineConfig({
  plugins: [rivetRouter({ clientRouter: true, styles: ["src/styles.css"], images: true }), tailwindcss()],
  logLevel: "warn",
});
