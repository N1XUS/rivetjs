import { defineConfig } from "vite";
import { rivet } from "@rivetjs/compiler/vite";
import { i18n } from "@rivetjs/i18n/vite";

export default defineConfig({
  plugins: [
    i18n({ locales: ["en", "de"], defaultLocale: "en", catalogs: "locales/{locale}.json" }),
    rivet({ resume: { modules: ["src/page.tsx"] } }),
  ],
  build: { rollupOptions: { input: "src/page.tsx" } },
});
