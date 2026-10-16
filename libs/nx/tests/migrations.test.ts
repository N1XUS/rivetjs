// migrations.json: every entry resolves to a migration module; the example migration changes nothing.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import exampleNoopMigration from "../migrations/0.0.1/example-noop.ts";
import { emptyWorkspace } from "./helpers.ts";

const LIB = join(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(LIB, "migrations.json"), "utf8")) as {
  generators: Record<string, { version: string; description: string; implementation: string }>;
  packageJsonUpdates: Record<string, unknown>;
};

test("migrations.json entries point at default-exported migrations", async () => {
  expect(Object.keys(manifest.generators)).toEqual(["example-noop"]);
  expect(manifest.packageJsonUpdates).toEqual({});
  for (const [name, entry] of Object.entries(manifest.generators)) {
    expect(entry.version, name).toMatch(/^\d+\.\d+\.\d+/);
    const module = (await import(join(LIB, entry.implementation + ".ts"))) as { default: unknown };
    expect(typeof module.default, name).toBe("function");
  }
});

test("example-noop leaves the workspace unchanged", async () => {
  const tree = emptyWorkspace();
  const before = tree.listChanges().length;
  await exampleNoopMigration(tree);
  expect(tree.listChanges()).toHaveLength(before);
});
