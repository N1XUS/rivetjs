import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Shell rules: every page stores its shell; `/search` and `/context` key only the `page` parameter.
export default defineConfig({
  plugins: [
    rivetRouter({
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
