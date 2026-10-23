// Zero-cost: an app that never imports resource() bundles none of its modules (dom-resource.ts, server-resource.ts, the shared
// resource.ts), Suspense users included; importing it bundles its module.
import { test } from "vitest";
import assert from "node:assert/strict";
import { rolldown } from "rolldown";

const root = new URL("../../../", import.meta.url).pathname;
const runtime = root + "libs/runtime";
const FILES = ["libs/runtime/dom-resource.ts", "libs/runtime/server-resource.ts", "libs/runtime/resource.ts"];

async function bundle(source: string): Promise<{ code: string; modules: string[] }> {
  const build = await rolldown({
    input: "entry",
    cwd: runtime,
    platform: "node",
    logLevel: "silent",
    external: [/^node:/, /^@rivetjs\/compiler/],
    resolve: { conditionNames: ["import", "production", "default"] },
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
    plugins: [{ name: "entry", resolveId: (id) => (id === "entry" ? id : null), load: (id) => (id === "entry" ? source : null) }],
  });
  const { output } = await build.generate({ format: "esm", minify: true });
  return { code: output[0].code, modules: output[0].moduleIds.map((id) => id.slice(root.length)) };
}

test("Async, Suspense and transitions bundle no resource module", async () => {
  for (const entry of ["@rivetjs/runtime/dom", "@rivetjs/runtime/server"]) {
    for (const name of ["Async", "Suspense", entry.endsWith("dom") ? "startTransition" : "clientOnly"]) {
      const { modules } = await bundle(`export { ${name} } from "${entry}";`);
      for (const file of FILES) assert.ok(!modules.includes(file), `${entry} ${name} bundles ${file}`);
    }
  }
});

test("importing resource bundles its module (dom) and the server Suspense build slot (server)", async () => {
  const dom = await bundle(`export { resource } from "@rivetjs/runtime/dom";`);
  assert.ok(dom.modules.includes("libs/runtime/dom-resource.ts"));
  const server = await bundle(`export { resource, Suspense } from "@rivetjs/runtime/server";`);
  assert.ok(server.modules.includes("libs/runtime/server-resource.ts"));
  assert.ok(!server.modules.includes("libs/runtime/server-derived.ts"), "a non-resumable server render bundles no resume renderer");
});
