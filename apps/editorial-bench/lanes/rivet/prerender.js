// Static lane: render every page (static routes + serverEntries) into dist/client.
import { prerenderBuild } from "@rivetjs/router/static";

const report = await prerenderBuild({ dist: "dist" });
console.log(`rivet: prerendered ${report.pages.length} page(s)`);
