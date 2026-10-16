// `rivetRouter({ bridges })` hands the framework bridges to the compiler plugin (`rivet({ bridges })`: the framework's
// own plugins + the bridge host before the compiler); CSR apps reject them (islands are server-rendered).
import { test } from "vitest";
import assert from "node:assert/strict";
import type { BridgeEntry } from "@rivetjs/compiler/vite";
import { rivetRouter } from "../build/vite.ts";

const fake: BridgeEntry = {
  name: "fake",
  owns: (id) => id.endsWith(".fake.tsx"),
  specifiers: ["fake-framework"],
  plugins: () => [{ name: "fake-framework-jsx" }],
  server: "fake/server",
  client: "fake/client",
};
const names = (plugins: { name: string }[]) => plugins.map((plugin) => plugin.name);

test("bridges: the framework plugins come before the compiler, which the router still drives", () => {
  const plain = names(rivetRouter());
  const bridged = names(rivetRouter({ bridges: [fake] }));
  assert.ok(bridged.indexOf("fake-framework-jsx") >= 0 && bridged.indexOf("fake-framework-jsx") < bridged.indexOf("vite-plugin-rivet"), bridged.join(" "));
  // Same router plugins around the compiler.
  for (const name of plain) assert.ok(bridged.includes(name), name);
  // An empty list = no bridges.
  assert.deepEqual(names(rivetRouter({ bridges: [] })), plain);
});

test("bridges + CSR: rejected", () => {
  assert.throws(() => rivetRouter({ mode: "csr", bridges: [fake] }), /framework bridges need server or static mode/);
});
