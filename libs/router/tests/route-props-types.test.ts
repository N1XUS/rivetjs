// Generated per-route props: `PageProps<"items/[id]">`, `LayoutProps<"items/_layout">` and typed
// `actionResult<"items/[id]">()` read params, loader data and action results from `.rivet/routes.d.ts`.
// Route modules are virtual files that use the types on themselves (`load(…)` / `actions(…)` exports, any name).
import { test } from "vitest";
import assert from "node:assert/strict";
import { generate } from "../build/codegen.ts";
import { routeTable } from "../build/routes.ts";

const modules: Record<string, string> = {
  "src/routes/_layout.tsx": `
import { load, type LayoutProps } from "@rivetjs/router";
export const siteData = load(() => ({ site: "Shop" }));
export default function Root({ data, params, children }: LayoutProps<"_layout">) {
  const site: string = data().site;
  const none: {} = params();
  return <div>{site}{String(none)}{children}</div>;
}`,
  "src/routes/items/_layout.tsx": `
import type { LayoutProps } from "@rivetjs/router";
export default function Items({ data, params, children }: LayoutProps<"items/_layout">) {
  const id: string | undefined = params().id;
  const nothing: undefined = data();
  return <section>{id}{String(nothing)}{children}</section>;
}`,
  "src/routes/items/index.tsx": `
import type { PageProps } from "@rivetjs/router";
export default function List({ params }: PageProps<"items/index">) {
  return <p>{String(params)}</p>;
}`,
  "src/routes/items/[id].tsx": `
import { actions, fail, load, redirect, type PageProps, type RequestEvent } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
export const loader = load(async ({ params }: RequestEvent<"items/[id]">) => {
  return { id: params.id, title: "Item", at: new Date() };
});
export const forms = actions({
  save: async () => (Math.random() > 0.5 ? { saved: true as const } : fail(400, { error: "Title required" })),
  remove: () => redirect("/items"),
});
export default function Item({ data, params }: PageProps<"items/[id]">) {
  const id: string = params.id;
  const at: Date = data.at;
  const result = actionResult<"items/[id]", "save">("save");
  const error: string | undefined = result?.status !== undefined ? result.result.error : undefined;
  const saved: true | undefined = result && result.status === undefined ? result.result.saved : undefined;
  return <h1>{data.title}{id}{at.getTime()}{error}{String(saved)}</h1>;
}`,
  "src/routes/docs/[[lang]]/[...path].tsx": `
import type { PageProps } from "@rivetjs/router";
export default function Doc({ data, params }: PageProps<"docs/[[lang]]/[...path]">) {
  const lang: string | undefined = params.lang;
  const path: string = params.path;
  const nothing: undefined = data;
  return <p>{lang}{path}{String(nothing)}</p>;
}`,
  "src/routes/blog/[slug].tsx": `
import type { PageProps } from "@rivetjs/router";
export default function Post({ data, params }: PageProps<"blog/[slug]">) {
  const slug: string = params.slug;
  const words: number = data.words;
  return <p>{slug}{words}</p>;
}`,
  "src/routes/blog/[slug].server.ts": `
// Sibling server module: same wrappers, found by tag.
import { actions, load } from "@rivetjs/router";
export const post = load(() => ({ words: 120 }));
export const likes = actions({ like: () => ({ likes: 1 }) });`,
};

const usage = `
import type { ActionResultOf, LayoutProps, PageProps } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import type { forms } from "./src/routes/items/[id].tsx";

// Positive: the action union narrows by name; the old forms keep working.
export function A() {
  const any = actionResult<"items/[id]">();
  const name: "save" | "remove" | undefined = any?.name;
  const likes: number | undefined = actionResult<"blog/[slug]", "like">("like")?.result.likes;
  const byObject: ActionResultOf<typeof forms, "save"> | undefined = actionResult<typeof forms, "save">("save");
  const plain = actionResult("save")?.result;
  return <p>{name}{likes}{String(byObject)}{String(plain)}</p>;
}
export function Old({ data, params }: PageProps<{ n: number }, { id: string }>) {
  return <p>{data.n}{params.id}</p>;
}
export function OldLayout({ data }: LayoutProps<{ site: string }>) {
  return <p>{data().site}</p>;
}

// Negative.
export function Bad({ data, params }: PageProps<"items/[id]">) {
  // @ts-expect-error not a param of items/[id]
  params.slug;
  // @ts-expect-error not in the loader data
  data.price;
  return null;
}
export function Unknown({ data, params }: PageProps<"items/[idd]">) {
  // @ts-expect-error unknown route id: data is unusable
  data.title;
  // @ts-expect-error unknown route id: params are unusable
  params.id;
  return null;
}
export function NoLoader({ data }: PageProps<"docs/[[lang]]/[...path]">) {
  // @ts-expect-error the route has no loader: data is undefined
  data.title;
  return null;
}
export function RootParams({ params }: LayoutProps<"_layout">) {
  // @ts-expect-error the root layout stays mounted and receives no params
  params().id;
  return null;
}
export function UnknownLayout({ data }: LayoutProps<"nope/_layout">) {
  // @ts-expect-error unknown layout id
  data().site;
  return null;
}
// @ts-expect-error not an action of items/[id]
actionResult<"items/[id]">("publish");
// @ts-expect-error the failure branch has no saved field
export const wrong: true = actionResult<"items/[id]", "save">("save")!.result.saved;
// @ts-expect-error a redirecting action has no result type
export const removed: never = actionResult<"items/[id]", "remove">("remove")!.result;
`;

async function diagnostics(files: Record<string, string>): Promise<string[]> {
  const { default: ts } = await import("typescript");
  const dir = new URL("./", import.meta.url).pathname + "__route_props__/";
  const options = {
    strict: true,
    noEmit: true,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "@rivetjs/runtime",
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts"],
    types: [],
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const read = host.readFile.bind(host), exists = host.fileExists.bind(host), source = host.getSourceFile.bind(host);
  const virtual = (name: string) => (name.startsWith(dir) ? files[name.slice(dir.length)] : undefined);
  host.readFile = (name) => virtual(name) ?? read(name);
  host.fileExists = (name) => virtual(name) !== undefined || exists(name);
  host.directoryExists = (name) => Object.keys(files).some((file) => (dir + file).startsWith(name.replace(/\/?$/, "/"))) || ts.sys.directoryExists(name);
  host.getSourceFile = (name, version, onError, create) => {
    const text = virtual(name);
    return text !== undefined ? ts.createSourceFile(name, text, version, true) : source(name, version, onError, create);
  };
  const program = ts.createProgram(Object.keys(files).map((name) => dir + name), options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .map((d) => (d.file ? d.file.fileName.replace(dir, "") + ":" + (d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1) + ": " : "") + ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

function routesTypes(): string {
  const files = Object.keys(modules).map((file) => file.slice("src/routes/".length));
  const exports = new Map([
    ["_layout.tsx", ["load"]],
    ["items/[id].tsx", ["load", "actions"]],
  ]);
  return generate(routeTable(files, exports), { routesDir: "src/routes" }).files["routes.d.ts"]!;
}

test("routes.d.ts: per-route RouteData, RouteActions, LayoutParams, LayoutData", () => {
  const types = routesTypes();
  assert.match(types, /"items\/\[id\]": ModuleData<typeof import\("\.\.\/src\/routes\/items\/\[id\]\.tsx"\)>;/);
  assert.match(types, /interface RouteActions \{[^}]*"blog\/\[slug\]": ModuleActions<typeof import\("\.\.\/src\/routes\/blog\/\[slug\]\.server\.ts"\)>;/);
  assert.match(types, /interface LayoutParams \{\s*"_layout": \{\};\s*"items\/_layout": \{ id\?: string \};\s*\}/);
  assert.match(types, /interface LayoutData \{\s*"_layout": ModuleData<typeof import\("\.\.\/src\/routes\/_layout\.tsx"\)>;\s*\}/);
});

test("PageProps/LayoutProps by id and typed actionResult: positives check, negatives fail", async () => {
  const errors = await diagnostics({ ".rivet/routes.d.ts": routesTypes(), ...modules, "usage.tsx": usage });
  assert.deepEqual(errors, [], errors.join("\n"));
});

test("without routes.d.ts a route id is unknown (no silent any)", async () => {
  const errors = await diagnostics({ "src/routes/items/[id].tsx": modules["src/routes/items/[id].tsx"]! });
  assert.ok(errors.some((e) => /not a route or layout id/.test(e) || /does not satisfy the constraint/.test(e)), errors.join("\n"));
});
