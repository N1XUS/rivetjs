// `virtual:docs/*` modules: on the server `examples` (examples.json) and `api` (api.json) are tiny modules that read +
// parse the file at runtime (never bundled); a client build gets an empty `examples` and a throwing `api` stand-in
// (server-only, SERVER-REACH: API pages are document routes with no browser code), the dev client the files.
import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, test } from "vitest";
import type { Plugin } from "vite";
import { docsSite } from "../vite.ts";
import { EXAMPLES_JSON } from "../tools/examples.ts";

const temp = mkdtempSync(join(tmpdir(), "docs-kit-modules-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));
mkdirSync(join(temp, "src/generated"), { recursive: true });
const manifest = join(temp, EXAMPLES_JSON);
writeFileSync(manifest, JSON.stringify({ hello: { id: "hello", title: "Hello" } }));

const plugin = docsSite().find((p) => p.name === "rivet-docs-modules") as Plugin & {
  configResolved(config: unknown): void;
  resolveId(this: unknown, source: string, importer?: string): string | null;
  api: { rivetServerOnly: unknown[] };
  load(this: unknown, id: string): string | null;
};
const resolveIn = (consumer: "server" | "client", name = "examples", importer?: string) =>
  plugin.resolveId.call({ environment: { config: { consumer } } }, "virtual:docs/" + name, importer);
/** Load a virtual module's code and import it from a temp file. */
async function importModule<T>(id: string, file: string): Promise<{ module: T; watched: string[]; code: string }> {
  const watched: string[] = [];
  const code = plugin.load.call({ addWatchFile: (path: string) => watched.push(path) }, id)!;
  writeFileSync(join(temp, file), code);
  return { module: (await import(pathToFileURL(join(temp, file)).href)) as T, watched, code };
}

test("server (dev and build): a runtime reader of examples.json", async () => {
  for (const command of ["serve", "build"]) {
    plugin.configResolved({ root: temp, command });
    const id = resolveIn("server")!;
    assert.notEqual(id, manifest);
    const server = await importModule<{ examples: Record<string, { title: string }> }>(id, `reader-${command}.mjs`);
    assert.ok(server.code.length < 1000);
    assert.deepEqual(server.watched, [manifest]);
    assert.equal(server.module.examples.hello!.title, "Hello");
  }
});

test("client: empty in a build, the parsed file on the dev server", () => {
  plugin.configResolved({ root: temp, command: "build" });
  const id = resolveIn("client")!;
  assert.equal(plugin.load.call({ addWatchFile() {} }, id), "export const examples = {};");
  plugin.configResolved({ root: temp, command: "serve" });
  assert.match(
    plugin.load.call({ addWatchFile() {} }, resolveIn("client")!)!,
    new RegExp(`import examples from ${JSON.stringify(JSON.stringify(manifest)).slice(1, -1)}`),
  );
});

test("api: the server parses api.json from disk (watched), a client build gets a throwing stand-in, the dev client the file", async () => {
  assert.deepEqual(plugin.api.rivetServerOnly, ["virtual:docs/api"]);
  plugin.configResolved({ root: temp, command: "build" });
  const file = join(temp, "src/generated/api.json");
  writeFileSync(file, JSON.stringify({ entries: [], symbols: [{ key: "k" }] }));
  const client = await importModule<{ default: { symbols: unknown[] } }>(resolveIn("client", "api", join(temp, "src/api.ts"))!, "api-client.mjs");
  assert.throws(() => client.module.default.symbols, {
    message:
      "[rivet] virtual:docs/api is server-only; reached from src/api.ts. The browser gets this stand-in, never the module: read it on the server (a load(…) export) and pass the data as props.",
  });
  assert.ok(!client.code.includes("symbols"), "no data in the stand-in");
  assert.deepEqual(client.watched, []);
  const server = await importModule<{ default: { symbols: { key: string }[] } }>(resolveIn("server", "api")!, "api.mjs");
  assert.ok(!server.code.includes('"symbols"'), "the data is not in the module");
  assert.deepEqual(server.watched, [file]);
  assert.equal(server.module.default.symbols[0]!.key, "k");
  plugin.configResolved({ root: temp, command: "serve" });
  assert.equal(resolveIn("client", "api"), file);
});
