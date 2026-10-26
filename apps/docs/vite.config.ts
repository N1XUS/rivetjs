import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { docsSite, FRAME_ROOT } from "@rivetjs/docs-kit/vite.ts";


/**
 * Static docs site on @rivetjs/docs-kit: content routes generated from Markdown (before the router
 * scans), prerendered by `docs-kit build`. Pages navigate with full loads (links carry
 * data-rivet-reload), so `prefetch: "document"` lets the browser fetch the next page on hover
 * (prev/next links: `prerender`, marked in docs-kit). Kit components (copy buttons, theme toggle,
 * search trigger) resume as source package modules.
 */
export default defineConfig({
  plugins: [
    docsSite(),
    rivetRouter({
      mode: "static",
      styles: ["src/styles.css"],
      prefetch: "document",
      prefetchPaths: false,
      resume: { roots: [FRAME_ROOT] },
      // Every locale a demo renders (`<html lang="en">`): component strings of other languages stay out of the browser build.
      locales: ["en-US", "de-DE", "ja-JP", "pt-BR", "uk"],
    }),
    tailwindcss(),
  ],
  define: {
    "process.env.DOCS_ORIGIN": JSON.stringify(process.env.DOCS_ORIGIN ?? "http://127.0.0.1:4321"),
  },
  server: { port: 4320 },
  logLevel: "warn",
});
