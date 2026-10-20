import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { docsSite, DOCS_LAZY_OWNED, DOCS_PRELOAD_RULES } from "@rivetjs/docs-kit/vite.ts";


/**
 * Home resume demo ("Click it. That's the only code this page has loaded."): its own named intent chunk
 * (`resume-index_tsx-like`, own sibling group), so the like handler's closure is the demo alone, not the home route's
 * widgets, routes table and cdk collections (HOME-CLICK 2026-10-20, cold click: 20 files / 201.5 KB brotli → 8 files /
 * 34.1 KB).
 */
const HOME_RULES = [{ match: "src/components/home/ResumeDemo.tsx#", strategy: "intent", chunk: "like" }] as const;

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
    rivetRouter({ mode: "static", styles: ["src/styles.css"], prefetch: "document", prefetchPaths: false, resume: { preload: { rules: [...DOCS_PRELOAD_RULES, ...HOME_RULES] }, lazyOwned: [...DOCS_LAZY_OWNED] } }),
    tailwindcss(),
  ],
  define: {
    "process.env.DOCS_ORIGIN": JSON.stringify(process.env.DOCS_ORIGIN ?? "http://127.0.0.1:4321"),
  },
  server: { port: 4320 },
  logLevel: "warn",
});
