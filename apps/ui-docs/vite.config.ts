import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { docsSite, FRAME_ROOT } from "@rivetjs/docs-kit/vite.ts";

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
      // Example frame pages that take props resume under their own root boundary (docs-kit `FrameRoot`).
      resume: { roots: [FRAME_ROOT] },
      // Every locale a demo renders (`<html lang="en">`): component strings of other languages stay out of the browser build.
      locales: ["en-US", "ar-EG", "de-DE", "hi-IN"],
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
