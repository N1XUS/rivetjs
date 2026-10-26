// Locale tables trimmed to the declared locales' languages (`locale-tables.ts`, ZERO UI-JS2).
import { afterAll, beforeAll, test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";
import { keptEntries, languagesOf, localeTables } from "../locale-tables.ts";
import { rivet } from "../vite.ts";

test("languages: first subtag + its canonical form, always en; no-ICU strings dropped", () => {
  assert.deepEqual([...languagesOf(["de-DE", "iw-IL", "tsx"])].sort(), ["de", "en", "he", "iw"]);
});

const TABLE = `import type { T } from "./t.ts";
// @rivet-locale-table
export const strings: T = {
  "de-AT": {"a":"Ö"},
  "de-DE": {"a":"D"},
  "en-US": {"a":"E"},
  "fr-FR": {"a":"F"},
  pt: { a: \`P\` },
};
export const other = { "en-US": 1 };
`;

test("tables: marked pure-data exports only; kept = every key of a kept language (source order) + en-US", () => {
  const [table, ...rest] = localeTables(TABLE, "/t/intl.ts");
  assert.equal(rest.length, 0);
  assert.equal(table!.name, "strings");
  assert.deepEqual(
    table!.entries.map(([key]) => key),
    ["de-AT", "de-DE", "en-US", "fr-FR", "pt"],
  );
  assert.deepEqual(
    keptEntries(table!, new Set(["en", "de"])).map(([key]) => key),
    ["de-AT", "de-DE", "en-US"],
  );
  assert.deepEqual(localeTables(TABLE.replace(`{"a":"F"}`, `{"a":f()}`), "/t/intl.ts"), [], "not pure data: left whole");
});

const here = fileURLToPath(new URL(".", import.meta.url));
let root = "";
beforeAll(async () => {
  root = await mkdtemp(join(here, ".locale-tables-"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "locale-tables-fixture", type: "module" }));
  await writeFile(join(root, "intl.ts"), TABLE.replace(`import type { T } from "./t.ts";\n`, "type T = Record<string, Record<string, string>>;\n"));
  await writeFile(
    join(root, "main.ts"),
    `import { strings } from "./intl.ts";\nconst LAZY = Symbol.for("rivet.locales");\nconsole.log(strings, (strings as any)[LAZY], "de-DE");\n`,
  );
});
afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

const run = async (ssr: boolean, locales?: readonly string[], i18nLocales?: readonly string[]) => {
  const out = (await build({
    root,
    logLevel: "silent",
    configFile: false,
    plugins: [...(i18nLocales ? [{ name: "vite-plugin-rivet-i18n", api: { config: { locales: i18nLocales } } }] : []), rivet({ locales })],
    build: { write: false, minify: false, ssr: ssr ? join(root, "main.ts") : undefined, rollupOptions: ssr ? {} : { input: join(root, "main.ts") } },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];
  return (Array.isArray(out) ? out : [out]).flatMap((o) => o.output).filter((o): o is Rollup.OutputChunk => o.type === "chunk");
};

test("build: declared locales keep their languages, the full table is a lazy chunk; undeclared and server keep it whole", async () => {
  const client = await run(false, ["de-DE"]);
  const entry = client.find((chunk) => chunk.isEntry)!;
  assert.match(entry.code, /"de-AT"/);
  assert.match(entry.code, /"de-DE"/);
  assert.match(entry.code, /"en-US"/);
  assert.doesNotMatch(entry.code, /"fr-FR"/);
  assert.match(entry.code, /rivet\.locales/);
  assert.match(entry.code, /\["de", "en"\]|\["de","en"\]/);
  const lazy = client.find((chunk) => !chunk.isEntry && chunk.code.includes("fr-FR"));
  assert.ok(lazy, "full table chunk");
  assert.match(lazy!.code, /"de-AT"[\s\S]*"de-DE"[\s\S]*"en-US"[\s\S]*"fr-FR"[\s\S]*"pt"/, "source order");
  const french = (await run(false, ["fr-CA"])).find((chunk) => chunk.isEntry)!;
  assert.match(french.code, /"fr-FR"/);
  assert.doesNotMatch(french.code, /"de-DE": /);
  const undeclared = (await run(false)).find((chunk) => chunk.isEntry)!;
  assert.match(undeclared.code, /"fr-FR"/);
  assert.doesNotMatch(undeclared.code, /rivet\.locales"\)\]: \{ l:|f: \(\) => import/);
  const server = (await run(true, ["de-DE"])).map((chunk) => chunk.code).join("\n");
  assert.match(server, /"fr-FR"/);
  assert.doesNotMatch(server, /__rivet_l/);
});

test("build: the i18n() plugin's locales are declared locales", async () => {
  const entry = (await run(false, undefined, ["fr-FR"])).find((chunk) => chunk.isEntry)!;
  assert.match(entry.code, /"fr-FR"/);
  assert.doesNotMatch(entry.code, /"de-DE": /);
});
