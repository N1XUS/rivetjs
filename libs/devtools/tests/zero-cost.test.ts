// Zero production cost: production resolution of every runtime / reactivity entry bundles none of the
// development façades or devtools events (the byte-for-byte hash gate compares against main in CI).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rolldown } from "rolldown";

const root = new URL("../../../", import.meta.url).pathname;
const DEV_FILES = ["libs/reactivity/dev.ts", "libs/reactivity/debug.ts", "libs/runtime/dev/dom.ts", "libs/runtime/dev/on.ts"];
// Event names of the development façades (reactivity/dev.ts, runtime/dev/on.ts — incl. `resume.region`): never in production bundles.
const DEV_STRINGS = [
  "rivet.devtools",
  "hot.update",
  "hot.register",
  "sig.write",
  "sig.create",
  "sig.internal",
  "comp.mount",
  "dom.update",
  "error.hint",
  "resume.region",
];

async function entries(): Promise<{ name: string; file: string }[]> {
  const list: { name: string; file: string }[] = [];
  for (const pkg of ["libs/reactivity", "libs/runtime"]) {
    const json = JSON.parse(await readFile(root + pkg + "/package.json", "utf8")) as { name: string; exports: Record<string, { default: string }> };
    for (const [key, value] of Object.entries(json.exports)) list.push({ name: json.name + key.slice(1), file: root + pkg + "/" + value.default });
  }
  return list;
}
async function bundle(file: string, conditions: string[]): Promise<{ code: string; modules: string[] }> {
  const build = await rolldown({
    input: file,
    platform: "node",
    logLevel: "silent",
    external: [/^node:/, /^@rivetjs\/compiler/],
    resolve: { conditionNames: conditions },
    transform: { define: { "process.env.NODE_ENV": conditions.includes("development") ? '"development"' : '"production"' } },
  });
  const { output } = await build.generate({ format: "esm", minify: true });
  return { code: output[0].code, modules: output[0].moduleIds.map((id) => id.slice(root.length)) };
}

test("production resolution bundles no development façade or devtools event", async () => {
  for (const { name, file } of await entries()) {
    if (name === "@rivetjs/reactivity/debug") continue; // the development tools entry itself
    const { code, modules } = await bundle(file, ["import", "production", "default"]);
    for (const dev of DEV_FILES) assert.ok(!modules.includes(dev), `${name} bundles ${dev}`);
    for (const text of DEV_STRINGS) assert.ok(!code.includes(text), `${name} contains "${text}"`);
  }
});

test("development resolution selects the façades (the check above can fail)", async () => {
  // Façades are selected through package specifiers: dom.ts imports `@rivetjs/reactivity`.
  const dom = await bundle(root + "libs/runtime/dom.ts", ["import", "development", "default"]);
  assert.ok(dom.modules.includes("libs/reactivity/dev.ts"));
  const hot = await bundle(root + "libs/runtime/hot.ts", ["import", "development", "default"]);
  for (const dev of ["libs/reactivity/dev.ts", "libs/runtime/dev/on.ts"]) assert.ok(hot.modules.includes(dev), dev);
  for (const text of ["rivet.devtools", "hot.update", "sig.create"]) assert.ok(hot.code.includes(text), text);
});
