// `nx g @rivetjs/nx:api-route api/items/[id] --project=web --methods=get,post`: an endpoint route (plain `.ts`
// in src/routes exporting request handlers). Server-rendered apps only: a prerendered site has no server.
import { fileURLToPath } from "node:url";
import { formatFiles, generateFiles, joinPathFragments, type Tree } from "@nx/devkit";
import { routedApp, routeSegments } from "../../utils/project.ts";
import { routeUrl } from "../route/generator.ts";
import type { ApiRouteGeneratorSchema } from "./schema.js";

export type { ApiRouteGeneratorSchema } from "./schema.js";

const FILES = fileURLToPath(new URL("./files", import.meta.url));
const METHODS = ["get", "post", "put", "patch", "delete"] as const;

export async function apiRouteGenerator(tree: Tree, options: ApiRouteGeneratorSchema): Promise<void> {
  const project = routedApp(tree, options.project, "api-route");
  if (project.facts?.static) throw new Error('api-route: endpoints need a server; this app is prerendered (rivetRouter({ mode: "static" }))');
  const segments = routeSegments(options.path);
  if (!segments.length) throw new Error("api-route: path is required (e.g. api/health)");
  const methods = [...new Set((options.methods ?? ["get"]).flatMap((method) => String(method).split(",")).map((method) => method.trim().toLowerCase()))];
  for (const method of methods) if (!(METHODS as readonly string[]).includes(method)) throw new Error(`api-route: unknown method "${method}"`);
  const folder = joinPathFragments(project.routes, ...segments.slice(0, -1));
  const fileName = segments.at(-1)!;
  for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
    if (tree.exists(joinPathFragments(folder, fileName + ext))) throw new Error(`api-route: ${joinPathFragments(folder, fileName + ext)} already exists`);
  }
  generateFiles(tree, FILES, folder, { fileName, methods: METHODS.filter((method) => methods.includes(method)), url: routeUrl(segments) });
  if (!options.skipFormat) await formatFiles(tree);
}

export default apiRouteGenerator;
