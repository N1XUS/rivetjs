import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { docsSite, DOCS_LAZY_OWNED } from "@rivetjs/docs-kit/vite.ts";

/**
 * Frame controls (theme menu, drawer, search) are cdk components whose hover handlers would make the
 * planner prefetch ~39 cdk modules once visible; load them on intent (pointer / focus) instead.
 */
const CDK_ON_INTENT = [{ match: "@rivetjs/cdk/", strategy: "intent" as const }];
/**
 * Chunk-policy experiments (derived-client plan M1, `docs/design/plans/2026-10-18-derived-client.md`): the measurement
 * builds set `RIVET_RESUME_CHUNKS` (`component` | `group` | `route`) and `RIVET_RESUME_MERGE` (bytes, or `off`) + `RIVET_RESUME_CAP`; unset =
 * the compiler defaults (what the site ships).
 */
const CHUNKS = process.env.RIVET_RESUME_CHUNKS as "component" | "group" | "route" | undefined;
const MERGE = process.env.RIVET_RESUME_MERGE === "off" ? false : process.env.RIVET_RESUME_MERGE ? Number(process.env.RIVET_RESUME_MERGE) : undefined;
const CAP = process.env.RIVET_RESUME_CAP ? Number(process.env.RIVET_RESUME_CAP) : undefined;

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
      resume: {
        preload: { rules: CDK_ON_INTENT },
        lazyOwned: [...DOCS_LAZY_OWNED],
        ...(CHUNKS ? { chunks: CHUNKS } : {}),
        ...(MERGE !== undefined ? { merge: MERGE } : {}),
        ...(CAP !== undefined ? { cap: CAP } : {}),
      },
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
