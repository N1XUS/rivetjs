import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { docsSite, DOCS_LAZY_OWNED, DOCS_PRELOAD_RULES } from "@rivetjs/docs-kit/vite.ts";

/** @rivetjs/cdk docs: a static site on @rivetjs/docs-kit (same engine as apps/docs). */
export default defineConfig({
  plugins: [
    docsSite(),
    rivetRouter({
      mode: "static",
      styles: ["src/styles.css"],
      prefetch: "document",
      prefetchPaths: false,
      resume: { preload: { rules: [...DOCS_PRELOAD_RULES] }, lazyOwned: [...DOCS_LAZY_OWNED] },
    }),
    tailwindcss(),
  ],
  define: {
    "process.env.CDK_DOCS_ORIGIN": JSON.stringify(process.env.CDK_DOCS_ORIGIN ?? "http://127.0.0.1:4323"),
  },
  server: { port: 4325 },
  logLevel: "warn",
});
