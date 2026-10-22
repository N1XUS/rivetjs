// Rivet lane build: server (generated entry) then client, through Vite's app builder → dist/ (or BD_DIST).
// Build env: BD_PREFETCH=off / BD_ALL_LOAD=1 select the report row variants, RIVET_RESUME_MODEL=derived the derived
// resume model (default output dist/derived; see vite.config.ts).
import { createBuilder } from "vite";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./", import.meta.url));
const derived = process.env.RIVET_RESUME_MODEL === "derived";
const dist = process.env.BD_DIST ?? (derived ? "dist/derived" : "dist");
await rm(resolve(root, dist), { recursive: true, force: true });
const builder = await createBuilder({
  root,
  configFile: resolve(root, "vite.config.ts"),
  logLevel: "warn",
  builder: {},
  build: { minify: true, outDir: dist + "/client" },
  environments: {
    ssr: {
      build: {
        outDir: dist + "/server",
        manifest: false,
        rollupOptions: { input: resolve(root, (derived ? ".rivet-derived" : ".rivet") + "/entry.server.tsx") },
      },
    },
  },
});
await builder.buildApp();
console.log("built " + dist);
