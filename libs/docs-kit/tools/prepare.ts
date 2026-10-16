// Generate what the TypeScript project needs without a full build: example frames + data, content routes, nav data
// and the router's `.rivet/` (`routes.d.ts`: per-route `PageProps<"route/id">`).
import { generateRoutes } from "@rivetjs/router/vite";
import { generateContent } from "./content/generate.ts";
import { generateExamples } from "./examples.ts";

/** Write example frames, content routes and route types for the app at `root`. */
export async function prepare(root: string): Promise<void> {
  await generateExamples(root);
  await generateContent(root);
  // Same options as vite.config.ts's rivetRouter (static site).
  await generateRoutes(root, { mode: "static" });
}
