// `nx g @rivetjs/nx:route blog/[slug] --project=web [--loader] [--action] [--guard] [--layout]`.
import { fileURLToPath } from "node:url";
import { formatFiles, generateFiles, joinPathFragments, type Tree } from "@nx/devkit";
import { routeComponentName, routedApp, routeParams, routeSegments } from "../../utils/project.ts";
import { layoutGenerator } from "../layout/generator.ts";
import type { RouteGeneratorSchema } from "./schema.js";

export type { RouteGeneratorSchema } from "./schema.js";

const FILES = fileURLToPath(new URL("./files", import.meta.url));

/** Sample `serverEntries` value of a route's params (`{ slug: "example" }`), or undefined without required params. */
export function sampleEntry(params: ReturnType<typeof routeParams>): string | undefined {
  const required = params.filter((param) => param.kind !== "optional");
  if (!required.length) return undefined;
  return `{ ${required.map((param) => `${param.name}: "${param.kind === "rest" ? "example/page" : "example"}"`).join(", ")} }`;
}

/** The URL pattern of route segments (`/blog/:slug`). */
export function routeUrl(segments: string[]): string {
  const parts = segments
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .map((segment) =>
      segment
        .replace(/^\[\[(.+)\]\]$/, ":$1?")
        .replace(/^\[\.\.\.(.+)\]$/, "*$1")
        .replace(/^\[(.+)\]$/, ":$1"),
    );
  return "/" + parts.join("/");
}

export async function routeGenerator(tree: Tree, options: RouteGeneratorSchema): Promise<void> {
  const project = routedApp(tree, options.project, "route");
  const segments = routeSegments(options.path);
  const params = routeParams(segments);
  if (options.action && project.facts?.static) throw new Error('route: serverActions need a server; this app is prerendered (rivetRouter({ mode: "static" }))');
  const index = !segments.length || /^\(.*\)$/.test(segments.at(-1)!) || /(^|\/)index(\.\w+)?\/?$/.test(options.path) || options.path.endsWith("/");
  const folder = joinPathFragments(project.routes, ...(index ? segments : segments.slice(0, -1)));
  const fileName = index ? "index" : segments.at(-1)!;
  for (const ext of [".tsx", ".jsx", ".ts"]) {
    if (tree.exists(joinPathFragments(folder, fileName + ext))) throw new Error(`route: ${joinPathFragments(folder, fileName + ext)} already exists`);
  }
  const name = routeComponentName(segments.filter((segment) => !/^\(.*\)$/.test(segment)));
  const title = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const first = params[0];
  const routerImports = [
    ...(options.guard ? ["deny"] : []),
    ...(options.action ? ["redirect"] : []),
    ...(options.loader || params.length ? ["type PageProps"] : []),
    ...(options.loader || options.action || options.guard ? ["type RequestEvent"] : []),
  ];
  const props = [...(options.loader ? ["data"] : []), ...(params.length ? ["params"] : [])];
  generateFiles(tree, FILES, folder, {
    fileName,
    componentName: name + "Page",
    title,
    url: routeUrl(segments),
    routerImports,
    guard: Boolean(options.guard),
    loader: Boolean(options.loader),
    action: Boolean(options.action),
    params,
    entries: project.facts?.static ? (sampleEntry(params) ?? "") : "",
    loaderTitle: first ? `\`${title}: \${params.${first.name} ?? ""}\`` : JSON.stringify(title),
    props: props.length ? `{ ${props.join(", ")} }: PageProps${options.loader ? "<typeof serverLoad>" : ""}` : "",
  });
  if (options.layout && !tree.exists(joinPathFragments(folder, "_layout.tsx"))) {
    await layoutGenerator(tree, { project: options.project, directory: folder.slice(project.routes.length + 1), skipFormat: true });
  }
  if (!options.skipFormat) await formatFiles(tree);
}

export default routeGenerator;
