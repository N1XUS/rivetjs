import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { i18n } from "@rivetjs/i18n/vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { config } from "./i18n.config.ts";

// i18n() before rivetRouter(): `t()` calls compile against the catalogs in locales/.
export default defineConfig({
  plugins: [i18n(config), rivetRouter({ mode: "static", styles: ["src/styles.css"] }), tailwindcss()],
});
