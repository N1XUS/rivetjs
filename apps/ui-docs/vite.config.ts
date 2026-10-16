import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { docsSite } from "@rivetjs/docs-kit/vite.ts";

/**
 * Frame controls (theme menu, drawer, search) are cdk components whose hover handlers would make the
 * planner prefetch ~39 cdk modules once visible; load them on intent (pointer / focus) instead.
 */
const CDK_ON_INTENT = [{ match: "@rivetjs/cdk/", strategy: "intent" as const }];

/**
 * @rivetjs/ui docs: a static site on @rivetjs/docs-kit (same engine as apps/docs and apps/cdk-docs). `images`: examples
 * (pages of this app, `/examples/<id>/frame/`) import pictures with `?image`.
 */
export default defineConfig({
  plugins: [
    docsSite(),
    rivetRouter({
      mode: "static",
      images: true,
      styles: ["src/styles.css"],
      prefetch: "document",
      prefetchPaths: false,
      resume: { preload: { rules: CDK_ON_INTENT } },
    }),
    tailwindcss(),
  ],
  define: {
    "process.env.UI_DOCS_ORIGIN": JSON.stringify(process.env.UI_DOCS_ORIGIN ?? "http://127.0.0.1:4327"),
    "process.env.DOCS_ORIGIN": JSON.stringify(process.env.DOCS_ORIGIN ?? "http://127.0.0.1:4321"),
    "process.env.CDK_DOCS_ORIGIN": JSON.stringify(process.env.CDK_DOCS_ORIGIN ?? "http://127.0.0.1:4323"),
  },
  server: { port: 4329 },
  logLevel: "warn",
});
