// Pay-per-use: an app importing `Async` but none of Suspense / startTransition / useTransition bundles
// none of their modules; importing one of them keeps the coordinator install (a bare top-level call in
// a `sideEffects: false` module would be dropped, leaving Suspense inert).
import { test } from "vitest";
import assert from "node:assert/strict";
import { rolldown } from "rolldown";

const root = new URL("../../../", import.meta.url).pathname;
const runtime = root + "libs/runtime";
const SUSPENSE_FILES = ["libs/runtime/dom-suspense.ts", "libs/runtime/server-suspense.ts", "libs/runtime/server-suspense-slot.ts"];

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

test("Async alone bundles no Suspense or transition module", async () => {
  for (const entry of ["@rivetjs/runtime/dom", "@rivetjs/runtime/server", "@rivetjs/runtime/router/dom", "@rivetjs/runtime/router/server"]) {
    const name = entry.includes("router") ? "Router" : "Async";
    const { modules } = await bundle(`export { ${name} } from "${entry}";`);
    for (const file of SUSPENSE_FILES) assert.ok(!modules.includes(file), `${entry} ${name} bundles ${file}`);
  }
});

test("importing Suspense or a transition keeps the coordinator install", async () => {
  for (const name of ["Suspense", "startTransition", "useTransition"]) {
    const { code, modules } = await bundle(`export { ${name} } from "@rivetjs/runtime/dom";`);
    assert.ok(modules.includes("libs/runtime/dom-suspense.ts"), `dom ${name} module`);
    // The coordinator's adapted props (`hold: true`) only exist when it is installed.
    assert.match(code, /hold:!0/, `dom ${name}`);
  }
  const { code, modules } = await bundle(`export { Suspense } from "@rivetjs/runtime/server";`);
  assert.ok(modules.includes("libs/runtime/server-suspense.ts"), "server Suspense module");
  // The pending hook marks the nearest Suspense.
  assert.match(code, /\.p=!0/, "server Suspense");
});
