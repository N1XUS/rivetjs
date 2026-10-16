// Render every page to an HTML file in dist/client (run after `vite build` and `vite build --ssr`).
import { prerenderBuild } from "@rivetjs/router/static";

const report = await prerenderBuild({ dist: "dist" });
console.log(`Prerendered ${report.pages.length} page(s) into dist/client`);
