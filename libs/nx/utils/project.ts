// The Rivet project a generator targets (`--project`).
import { joinPathFragments, readProjectConfiguration, type Tree } from "@nx/devkit";
import type { ProjectFacts } from "./detect.ts";
import { treeFacts } from "./facts.ts";

export interface RivetProject {
  name: string;
  root: string;
  /** `<root>/src` (or the project's sourceRoot). */
  src: string;
  /** `<src>/routes`. */
  routes: string;
  facts: ProjectFacts | undefined;
  /** A library (`projectType: library`, or no Vite config). */
  library: boolean;
}

export function rivetProject(tree: Tree, name: string): RivetProject {
  const config = readProjectConfiguration(tree, name);
  const root = config.root;
  const src = config.sourceRoot ?? joinPathFragments(root, "src");
  const facts = treeFacts(tree, root);
  const library = config.projectType === "library" || (facts?.kind ?? "lib") === "lib";
  return { name, root, src, routes: joinPathFragments(src, "routes"), facts, library };
}

/** Throws unless the project is a file-routed Rivet app (`rivetRouter()` in its Vite config). */
export function routedApp(tree: Tree, name: string, generator: string): RivetProject {
  const project = rivetProject(tree, name);
  if (project.facts?.kind !== "app") throw new Error(`${generator}: ${name} is not a Rivet app with file routes (no rivetRouter() in its vite.config)`);
  return project;
}

/** Route path → segments: `blog/[slug]` → `["blog", "[slug]"]` (leading `/`, `src/routes/`, extension and `index` dropped). */
export function routeSegments(path: string): string[] {
  const clean = path
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/^src\/routes\//, "")
    .replace(/\.(tsx|ts|jsx|js)$/, "");
  const segments = clean.split("/").filter(Boolean);
  if (segments.at(-1) === "index") segments.pop();
  for (const segment of segments) {
    if (!/^(\[\[[A-Za-z_$][\w$]*\]\]|\[(\.\.\.)?[A-Za-z_$][\w$]*\]|\([\w-]+\)|[\w.-]+)$/.test(segment))
      throw new Error(`Invalid route segment "${segment}" (use name, [param], [[optional]], [...rest] or (group))`);
  }
  return segments;
}

/** Params of route segments: `[slug]` → `{ name: "slug", kind: "one" }`. */
export interface RouteParam {
  name: string;
  kind: "one" | "optional" | "rest";
}

export function routeParams(segments: string[]): RouteParam[] {
  return segments.flatMap((segment): RouteParam[] => {
    const optional = /^\[\[(.+)\]\]$/.exec(segment);
    if (optional) return [{ name: optional[1]!, kind: "optional" as const }];
    const rest = /^\[\.\.\.(.+)\]$/.exec(segment);
    if (rest) return [{ name: rest[1]!, kind: "rest" as const }];
    const one = /^\[(.+)\]$/.exec(segment);
    return one ? [{ name: one[1]!, kind: "one" as const }] : [];
  });
}

/** `PascalCase` name of route segments (`blog/[slug]` → `BlogSlug`; root → `Home`). */
export function routeComponentName(segments: string[]): string {
  const words = segments
    .map((segment) => segment.replace(/[[\]().]/g, " "))
    .join(" ")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const name = words.map((word) => word[0]!.toUpperCase() + word.slice(1)).join("");
  return name && /^[A-Za-z]/.test(name) ? name : "Home";
}

/** `../` from a file in `dir` (workspace-relative) back to `to`. */
export function relativeImport(fromDir: string, to: string): string {
  const from = fromDir.split("/").filter(Boolean);
  const target = to.split("/").filter(Boolean);
  let common = 0;
  while (common < from.length && common < target.length - 1 && from[common] === target[common]) common++;
  const up = from.length - common;
  const rel = [...Array.from({ length: up }, () => ".."), ...target.slice(common)].join("/");
  return rel.startsWith(".") ? rel : "./" + rel;
}
