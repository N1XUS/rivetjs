// DIAG-VERBOSE fix 1 (M1): on the dev server, a cdk dev warning raised below cdk + runtime frames names the app code
// that rendered it (`globalThis[Symbol.for("rivet.locate")]`, `vite.ts` `configureServer`: a 60-frame probe,
// source-mapped through `ssrFixStacktrace`). With V8's default 10 frames only the innermost app frame (`Bar`) is left;
// the outer one (`Panel`) proves the deeper probe.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { rivet } from "../vite.ts";

test("vite dev server: a cdk warning names the app components that rendered it (`at Bar (src/field.tsx:…) ← at Panel (…)`)", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-locate-"));
  await mkdir(resolve(root, "src"));
  await writeFile(
    resolve(root, "src/field.tsx"),
    'import { Checkbox } from "@rivetjs/cdk/checkbox";\n\nexport function Bar() {\n  return <Checkbox />;\n}\nexport function Panel() {\n  return <section><Bar /></section>;\n}\n',
  );
  await writeFile(
    resolve(root, "src/page.tsx"),
    'import { renderToString } from "@rivetjs/runtime/server";\nimport { Panel } from "./field.tsx";\n\nexport function Page() {\n  return <main><Panel /></main>;\n}\nexport const html = () => renderToString(() => <Page />);\n',
  );
  const server = await createServer({ root, configFile: false, logLevel: "silent", plugins: [rivet()], server: { middlewareMode: true }, appType: "custom" });
  const env = process.env.NODE_ENV;
  const warn = console.warn;
  const warnings: string[] = [];
  try {
    const page = (await server.ssrLoadModule("/src/page.tsx")) as { html(): string | Promise<string> };
    process.env.NODE_ENV = "development";
    console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(" "));
    await page.html();
  } finally {
    console.warn = warn;
    process.env.NODE_ENV = env;
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
  const box = warnings.find((text) => text.startsWith("[rivet:cdk] checkbox:"));
  assert.ok(box, warnings.join("\n---\n") || "no warning");
  assert.match(box, /\n {2}at Bar \(src\/field\.tsx:4:\d+\) ← at Panel \(src\/field\.tsx:7:\d+\)$/);
  // Closing the server removes its hook.
  assert.equal((globalThis as { [key: symbol]: unknown })[Symbol.for("rivet.locate")], undefined);
});
