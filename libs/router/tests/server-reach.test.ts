// Server reach (SERVER-REACH, spec docs/design/specs/2026-10-20-server-reach-design.md): page routes reaching a
// server-only module through their own module + helpers are document routes; components, layouts and error pages
// reaching one are RV3011 (error, or a warning with `serverOnly: { reach: "warn" }`); type-only imports and code only
// server exports use do not count. `analyzeReach` directly, then the Vite builds (generated App, error text, stand-in).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { build, createLogger, createServer, type Plugin } from "vite";
import { analyzeReach } from "../build/reach.ts";
import { scanRoutes } from "../build/routes.ts";
import { rivetRouter } from "../build/vite.ts";
import { serverOnlyStub } from "@rivetjs/compiler/vite";
import { nodeEnv, withNodeEnv } from "./vite-env.ts";

const root = new URL("./fixture-reach/", import.meta.url).pathname.replace(/\/$/, "");
// Relative specifiers only (the fixture imports nothing else the walk follows); packages and virtual ids: unresolved.
const resolveRelative = async (spec: string, importer: string) => (spec.startsWith(".") ? resolve(dirname(importer), spec) : undefined);

async function analyze(routes: string, reach?: "error" | "warn") {
  const routesDir = resolve(root, routes);
  const table = await scanRoutes(routesDir);
  const routeModules = new Set(table.routes.flatMap((route) => [route, ...route.layouts]).flatMap((m) => (m.page ? [resolve(routesDir, m.page)] : [])));
  return analyzeReach({ root, routesDir, table, resolve: resolveRelative, serverOnly: ["virtual:reach-data"], ...(reach ? { reach } : {}), routeModules });
}

test("page routes: own helpers → document route; components → RV3011 naming the chain and the routes", async () => {
  const result = await analyze("src/routes");
  assert.deepEqual([...result.documents.keys()].sort(), ["declared.tsx", "docs.tsx"]);
  assert.deepEqual(result.documents.get("docs.tsx"), ["src/routes/docs.tsx", "src/lib/data.ts", "virtual:reach-data"]);
  assert.equal(result.problems.length, 1);
  const [problem] = result.problems;
  assert.equal(problem!.severity, "error");
  assert.deepEqual(problem!.chain, ["src/components/Card.tsx", "src/lib/data.ts", "virtual:reach-data"]);
  assert.deepEqual(problem!.routes, ["/"]);
  assert.match(
    problem!.message,
    /^\[rivet:router\] RV3011 src\/components\/Card\.tsx → src\/lib\/data\.ts → virtual:reach-data \(server-only\), rendered by \/ \(client-navigated page route\)\n {2}fix: .+\n {2}docs: https:\/\/rivetjs\.severyn\.pro\/errors\/RV3011$/,
  );
  // Type-only imports and loader-only code are no browser imports; `*.server.ts` behind them is never reached.
  for (const page of ["typed.tsx", "loaded.tsx"]) assert.ok(!result.documents.has(page), page);
  // Stand-in bookkeeping: the document page's import of the virtual module, and its imported names.
  const data = resolve(root, "src/lib/data.ts");
  assert.ok(result.documentOnly.has(resolve(root, "src/routes/docs.tsx")));
  assert.ok(!result.documentOnly.has(data), "data.ts is also in the client-rendered Card graph");
  assert.deepEqual([...result.names.get("virtual:reach-data")!], ["default"]);
});

test('`reach: "warn"`: the component report is a warning and its pages render as document routes', async () => {
  const result = await analyze("src/routes", "warn");
  assert.deepEqual([...result.documents.keys()].sort(), ["declared.tsx", "docs.tsx", "index.tsx"]);
  assert.equal(result.problems[0]!.severity, "warning");
  assert.match(result.problems[0]!.message, /rendered as document routes/);
  // Every graph reaching `data.ts` is a document page's now: the stand-in covers it.
  assert.ok(result.documentOnly.has(resolve(root, "src/lib/data.ts")));
});

test("layouts reaching a server-only module: RV3011 for the routes under them (also with reach: warn)", async () => {
  const result = await analyze("src/layout-routes", "warn");
  assert.deepEqual([...result.documents.keys()], []);
  assert.equal(result.problems.length, 1);
  assert.equal(result.problems[0]!.severity, "error");
  assert.equal(result.problems[0]!.kind, "layout");
  assert.deepEqual(result.problems[0]!.routes, ["/admin"]);
  assert.match(
    result.problems[0]!.message,
    /^\[rivet:router\] RV3011 src\/layout-routes\/admin\/_layout\.tsx → src\/components\/Card\.tsx → src\/lib\/data\.ts → virtual:reach-data \(server-only\), rendered by the layout of every page under \/admin/,
  );
});

test("browser stand-in: throws naming the module and the chain on any use", async () => {
  const source = serverOnlyStub("virtual:x", ["src/routes/a.tsx", "src/lib/b.ts"], ["default", "items", "not-an-identifier"]);
  const module = (await import("data:text/javascript," + encodeURIComponent(source))) as Record<string, any>;
  const expected = /^\[rivet\] virtual:x is server-only; reached from src\/routes\/a\.tsx → src\/lib\/b\.ts\./;
  for (const use of [() => module.default.entries, () => module.items(), () => String(module["not-an-identifier"]), () => "x" in module.default])
    assert.throws(use, { message: expected });
});

const data: Plugin = {
  name: "reach-data",
  resolveId: (id) => (id === "virtual:reach-data" ? "\0reach-data" : null),
  load: (id) => (id === "\0reach-data" ? 'export default "server data";' : null),
};

test("vite build: RV3011 fails the client build; reach: warn builds with the pages as document routes", async () => {
  await rm(resolve(root, "dist"), { recursive: true, force: true });
  await assert.rejects(
    withNodeEnv("production", () =>
      build({ root, configFile: false, logLevel: "silent", plugins: [rivetRouter({ serverOnly: ["virtual:reach-data"] }), data] }),
    ),
    (error: Error) => {
      assert.match(
        error.message,
        /RV3011 src\/components\/Card\.tsx → src\/lib\/data\.ts → virtual:reach-data \(server-only\), rendered by \/ \(client-navigated page route\)/,
      );
      return true;
    },
  );
  const warnings: string[] = [];
  const logger = createLogger("warn");
  logger.warn = (message) => void warnings.push(message);
  await withNodeEnv("production", () =>
    build({
      root,
      configFile: false,
      logLevel: "warn",
      customLogger: logger,
      plugins: [rivetRouter({ serverOnly: { modules: ["virtual:reach-data"], reach: "warn" } }), data],
    }),
  );
  assert.ok(
    warnings.some((message) => message.includes("RV3011 src/components/Card.tsx")),
    warnings.join("\n"),
  );
  const app = await readFile(resolve(root, ".rivet/app.tsx"), "utf8");
  const paths = JSON.parse(/const PATHS: readonly string\[\] = (\[[^\]]*\]);/.exec(app)![1]!) as string[];
  const rows = JSON.parse(/for \(const n of (\[[\d,]*\]) as const\) modules\[n\] = \[PATHS\[n\]!, _endpoint\];/.exec(app)![1]!) as number[];
  assert.deepEqual(rows.map((n) => paths[n]).sort(), ["/", "/declared", "/docs"]);
  await rm(resolve(root, "dist"), { recursive: true, force: true });
});

test("dev server: a page whose component reaches a server-only module reports RV3011 on load (terminal once, overlay)", async () => {
  const restore = nodeEnv("development");
  const errors: string[] = [];
  const logger = createLogger("error");
  logger.error = (message) => void errors.push(message);
  const server = await createServer({
    root,
    configFile: false,
    customLogger: logger,
    server: { port: 0 },
    plugins: [rivetRouter({ serverOnly: ["virtual:reach-data"] }), data],
  });
  await server.listen();
  try {
    const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
    for (let i = 0; i < 2; i++) {
      const html = await (await fetch(origin + "/", { headers: { accept: "text/html" } })).text();
      assert.match(html, /<!-- \[rivet:router\] RV3011 src\/components\/Card\.tsx → src\/lib\/data\.ts → virtual:reach-data \(server-only\)/);
      assert.match(html, /new ErrorOverlay\(/);
    }
    assert.equal(errors.filter((message) => message.includes("RV3011")).length, 1, errors.join("\n"));
    // A document route and a plain page: no report.
    for (const path of ["/docs", "/typed"])
      assert.doesNotMatch(await (await fetch(origin + path, { headers: { accept: "text/html" } })).text(), /RV3011/, path);
  } finally {
    await server.close();
    restore();
  }
});
