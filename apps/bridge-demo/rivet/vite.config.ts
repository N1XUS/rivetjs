// Rivet lane of apps/bridge-demo: file routes rendered per request, the shared React components as islands
// (`@rivetjs/bridge-react`). Build env switches (one build per report row): `BD_PREFETCH=off` = the no-prefetch row
// (no document prefetch, links `prefetch="none"`); `BD_ALL_LOAD=1` = the fairness control (every island `load`).
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { react } from "@rivetjs/bridge-react/vite";

const noPrefetch = process.env.BD_PREFETCH === "off";
export default defineConfig({
  define: {
    "import.meta.env.BD_PREFETCH": JSON.stringify(noPrefetch ? "off" : ""),
    "import.meta.env.BD_ALL_LOAD": JSON.stringify(process.env.BD_ALL_LOAD === "1" ? "1" : ""),
  },
  plugins: [rivetRouter({ styles: ["../site.css"], bridges: [react()], ...(noPrefetch ? {} : { prefetch: "document" as const }) })],
});
