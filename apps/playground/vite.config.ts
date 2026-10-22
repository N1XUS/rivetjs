import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

/** File routes (src/routes) resumed from server HTML; components outside routes resume when listed.
 * `?image` imports are optimised at build (`build.ts` uses the app builder so server-only images ship). */
export default defineConfig({
  plugins: [
    rivetRouter({
      clientRouter: true,
      styles: ["src/styles.css"],
      resume: { modules: ["src/resume-demo.tsx", "src/page-views.tsx"] },
      images: { presets: { hero: { layout: "full-width" } } },
      transitions: true,
    }),
    tailwindcss(),
  ],
});
