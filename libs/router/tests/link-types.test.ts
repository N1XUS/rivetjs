// `<Link to>` is typed by the generated RouteRegistry (`RoutePath`); without it, any string passes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { generate } from "../build/codegen.ts";
import { routeTable } from "../build/routes.ts";

const usage = `
import { Link } from "@rivetjs/router/link";
import { Link as ClientLink } from "@rivetjs/router/client";
import type { RoutePath } from "@rivetjs/router";
export const ok = [
  <Link to="/">Home</Link>,
  <Link to="/items/42?tab=a#top" transition={["zoom"]} prefetch="none" pending="busy">Item</Link>,
  <Link to="/docs/a/b" replace>Docs</Link>,
  <ClientLink to="/items/1">Same component</ClientLink>,
];
const path: RoutePath = "/items/1";
export const bad = [
  // @ts-expect-error not a route of this app
  <Link to="/nope">Nope</Link>,
  // @ts-expect-error prefetch values are "intent" | "none"
  <Link to="/" prefetch="eager">Home</Link>,
  // @ts-expect-error the client export is the same typed component
  <ClientLink to="/nope">Nope</ClientLink>,
];
export { path };
`;

async function diagnostics(files: Record<string, string>): Promise<string[]> {
  const { default: ts } = await import("typescript");
  const dir = new URL("./", import.meta.url).pathname + "__link_types__/";
  const options = {
    strict: true,
    noEmit: true,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "@rivetjs/runtime",
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const read = host.readFile.bind(host), exists = host.fileExists.bind(host), source = host.getSourceFile.bind(host);
  const virtual = (name: string) => (name.startsWith(dir) ? files[name.slice(dir.length)] : undefined);
  host.readFile = (name) => virtual(name) ?? read(name);
  host.fileExists = (name) => virtual(name) !== undefined || exists(name);
  host.getSourceFile = (name, version, onError, create) => {
    const text = virtual(name);
    return text !== undefined ? ts.createSourceFile(name, text, version, true) : source(name, version, onError, create);
  };
  const program = ts.createProgram(Object.keys(files).map((name) => dir + name), options, host);
  return ts.getPreEmitDiagnostics(program).map((d) => (d.file ? d.file.fileName.slice(dir.length) + ": " : "") + ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

test("Link to: generated RoutePath accepts app pages (+ query/hash) and rejects others", async () => {
  const table = routeTable(["index.tsx", "items/[id].tsx", "docs/[...path].tsx"]);
  const types = generate(table, { routesDir: "src/routes" }).files["routes.d.ts"]!;
  assert.deepEqual(await diagnostics({ "routes.d.ts": types, "usage.tsx": usage }), []);
});

test("Link to: without routes.d.ts any string is accepted", async () => {
  const errors = await diagnostics({ "usage.tsx": usage });
  // Only the route check's expectation goes unused; the prefetch check still applies.
  assert.equal(errors.length, 2, errors.join("\n"));
  for (const error of errors) assert.match(error, /Unused .@ts-expect-error. directive/);
});
