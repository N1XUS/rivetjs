// Render every page to an HTML file in dist/client (run after the per-locale `vite build`s and `vite build --ssr`).
import { prerenderBuild } from "@rivetjs/router/static";

// The locales of i18n.config.ts, in the same order: one client build each (dist/client/<locale>/).
const report = await prerenderBuild({ dist: "dist", locales: ["en", "uk"] });
console.log(`Prerendered ${report.pages.length} page(s) into dist/client`);
