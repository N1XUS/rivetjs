import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { docsSite } from "@rivetjs/docs-kit/vite.ts";

/** @rivetjs/cdk docs: a static site on @rivetjs/docs-kit (same engine as apps/docs). */
export default defineConfig({
  plugins: [
    docsSite(),
    rivetRouter({
      mode: "static",
      styles: ["src/styles.css"],
      prefetch: "document",
      prefetchPaths: false,
    }),
    tailwindcss(),
  ],
  define: {
    "process.env.CDK_DOCS_ORIGIN": JSON.stringify(process.env.CDK_DOCS_ORIGIN ?? "http://127.0.0.1:4323"),
    "process.env.DOCS_ORIGIN": JSON.stringify(process.env.DOCS_ORIGIN ?? "http://127.0.0.1:4321"),
    "process.env.UI_DOCS_ORIGIN": JSON.stringify(process.env.UI_DOCS_ORIGIN ?? "http://127.0.0.1:4327"),
  },
  server: { port: 4325 },
  logLevel: "warn",
});
