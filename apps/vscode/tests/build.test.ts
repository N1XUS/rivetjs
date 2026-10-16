// The staged extension is self-contained: its manifest contributes the plugin, and tsserver's own
// resolution (from the extension root, as VS Code passes it as a probe location) finds the bundle.
import { test } from "vitest";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { buildExtension, extensionDir } from "../build.ts";

test("dist/extension holds the manifest, extension bundle and a loadable plugin", async () => {
  await buildExtension();
  const manifest = JSON.parse(readFileSync(extensionDir + "package.json", "utf8"));
  assert.equal(`${manifest.publisher}.${manifest.name}`, "rivetjs.rivet");
  assert.deepEqual(manifest.contributes.typescriptServerPlugins, [{ name: "@rivetjs/typescript-plugin", enableForWorkspaceTypeScriptVersions: true }]);
  assert.ok(existsSync(extensionDir + "extension.cjs"));
  const require = createRequire(extensionDir + "package.json");
  const init = require("@rivetjs/typescript-plugin");
  assert.equal(typeof init, "function");
  const plugin = init({ typescript: require("typescript") });
  assert.equal(typeof plugin.create, "function");
  assert.ok(existsSync(extensionDir + "node_modules/@rivetjs/typescript-plugin/dist/rivet_compiler.wasm"));
});

test("dist/extension carries the repo license (vsce package runs unattended: MIT manifest + LICENSE file)", async () => {
  await buildExtension();
  const manifest = JSON.parse(readFileSync(extensionDir + "package.json", "utf8"));
  assert.equal(manifest.license, "MIT");
  assert.equal(readFileSync(extensionDir + "LICENSE", "utf8"), readFileSync(new URL("../../../LICENSE", import.meta.url), "utf8"));
});
