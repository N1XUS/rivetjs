// Rivet lane of apps/bridge-demo: file routes rendered per request, the shared React components as islands
// (`@rivetjs/bridge-react`). Build env switches (one build per report row): `BD_PREFETCH=off` = the no-prefetch row
// (no document prefetch, links `prefetch="none"`); `BD_ALL_LOAD=1` = the fairness control (every island `load`);
// `BD_FULL_TAIL=1` = the pre-D-lean baseline (`@rivetjs/bridge`'s `offerLean` stubbed: every page keeps the full
// resume driver, so its runtime cost is measured on the same app); `RIVET_RESUME_MODEL=derived` = the derived resume
// model (routes generated into `.rivet-derived/`, build into `dist/derived`).
import { defineConfig, type Plugin } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { react } from "@rivetjs/bridge-react/vite";

const noPrefetch = process.env.BD_PREFETCH === "off";
const derived = process.env.RIVET_RESUME_MODEL === "derived";
const fullTail: Plugin = {
  name: "bridge-demo:full-tail",
  enforce: "pre",
  transform(code, id) {
    if (!/[\\/]bridge[\\/]lean\.ts$/.test(id)) return;
    if (!code.includes("export function offerLean(")) throw new Error("BD_FULL_TAIL: no offerLean in " + id);
    return code.replace("export function offerLean(", "export function offerLean(): void {}\nfunction offerLeanUnused(");
  },
};
export default defineConfig({
  define: {
    "import.meta.env.BD_PREFETCH": JSON.stringify(noPrefetch ? "off" : ""),
    "import.meta.env.BD_ALL_LOAD": JSON.stringify(process.env.BD_ALL_LOAD === "1" ? "1" : ""),
  },
  plugins: [
    ...(process.env.BD_FULL_TAIL === "1" ? [fullTail] : []),
    rivetRouter({
      styles: ["../site.css"],
      bridges: [react()],
      ...(noPrefetch ? {} : { prefetch: "document" as const }),
      ...(derived ? { resume: { model: "derived" as const }, outDir: ".rivet-derived" } : {}),
    }),
  ],
});
