// Plugin manifests: generators.json / executors.json entries resolve (factory / implementation + schema, valid JSON
// with descriptions), package.json wiring, version drift against @rivetjs/testing, vite config edits.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { addImport, addPlugin, removePlugin, setRouterOption } from "../utils/vite-config.ts";
import { HAPPY_DOM_VERSION, NX_VERSION, toolVersion, VITEST_VERSION } from "../utils/versions.ts";

const LIB = join(import.meta.dirname, "..");
const json = <T>(path: string): T => JSON.parse(readFileSync(join(LIB, path), "utf8")) as T;

describe("manifests", () => {
  const pkg = json<{
    generators: string;
    executors: string;
    "nx-migrations": { migrations: string };
    dependencies: Record<string, string>;
    exports: Record<string, unknown>;
  }>("package.json");

  test("package.json fields", () => {
    expect(pkg.generators).toBe("./generators.json");
    expect(pkg.executors).toBe("./executors.json");
    expect(pkg["nx-migrations"].migrations).toBe("./migrations.json");
    expect(Object.keys(pkg.exports)).toContain("./plugin");
    const root = json<{ devDependencies: Record<string, string> }>("../../package.json");
    expect(pkg.dependencies["@nx/devkit"]).toBe(root.devDependencies["nx"]);
    expect(NX_VERSION).toBe(root.devDependencies["nx"]);
  });

  test("generators.json", async () => {
    const generators = json<{ generators: Record<string, { factory: string; schema: string; description: string }> }>("generators.json").generators;
    expect(Object.keys(generators)).toEqual([
      "preset",
      "init",
      "application",
      "library",
      "component",
      "route",
      "layout",
      "api-route",
      "ui-setup",
      "i18n-setup",
    ]);
    for (const [name, entry] of Object.entries(generators)) {
      expect(entry.description, name).toBeTruthy();
      expect(existsSync(join(LIB, entry.factory + ".ts")), name).toBe(true);
      const dir = join(LIB, entry.schema, "..");
      expect(existsSync(join(dir, "schema.d.ts")), name).toBe(true);
      const schema = json<{ properties: Record<string, { description?: string }> }>(entry.schema);
      for (const [key, value] of Object.entries(schema.properties)) expect(value.description, `${name}.${key}`).toBeTruthy();
      const module = (await import(join(LIB, entry.factory + ".ts"))) as { default: unknown };
      expect(typeof module.default, name).toBe("function");
    }
  });

  test("executors.json", async () => {
    const executors = json<{ executors: Record<string, { implementation: string; schema: string; description: string }> }>("executors.json").executors;
    expect(Object.keys(executors)).toEqual(["build", "dev", "serve", "preview", "prerender", "check", "test", "typecheck", "package"]);
    for (const [name, entry] of Object.entries(executors)) {
      expect(entry.description, name).toBeTruthy();
      expect(existsSync(join(LIB, entry.schema, "..", "schema.d.ts")), name).toBe(true);
      const schema = json<{ properties: Record<string, { description?: string }>; additionalProperties: boolean }>(entry.schema);
      expect(schema.additionalProperties, name).toBe(false);
      const module = (await import(join(LIB, entry.implementation + ".ts"))) as { default: unknown };
      expect(typeof module.default, name).toBe("function");
    }
  });

  test("tool versions: testing peers and starters", () => {
    const testing = json<{ peerDependencies: Record<string, string> }>("../testing/package.json").peerDependencies;
    expect(VITEST_VERSION).toBe(testing["vitest"]);
    expect(HAPPY_DOM_VERSION).toBe(testing["happy-dom"]);
    expect(toolVersion("vite")).toBe(testing["vite"]);
    expect(() => toolVersion("left-pad")).toThrow(/no starter/);
  });
});

describe("vite config edits", () => {
  const config =
    'import { defineConfig } from "vite";\nimport { rivetRouter } from "@rivetjs/router/vite";\n\nexport default defineConfig({ plugins: [rivetRouter({ mode: "static" })] });\n';

  test("imports and plugins, idempotent", () => {
    const once = addPlugin(addImport(config, 'import x from "x";'), "x()", "first");
    expect(once).toContain('import { rivetRouter } from "@rivetjs/router/vite";\nimport x from "x";\n');
    expect(once).toContain("plugins: [x(), rivetRouter(");
    expect(addPlugin(addImport(once, 'import x from "x";'), "x()", "first")).toBe(once);
    expect(addPlugin("export default { plugins: [] }", "a()")).toBe("export default { plugins: [a()] }");
    expect(addPlugin("export default { plugins: [b(),\n] }", "a()")).toBe("export default { plugins: [b(), a()] }");
    expect(() => addPlugin("export default {}", "a()")).toThrow(/no `plugins/);
  });

  test("remove a plugin and its import", () => {
    const withTw = 'import tailwindcss from "@tailwindcss/vite";\nexport default { plugins: [rivetRouter(), tailwindcss()] };\n';
    expect(removePlugin(withTw, "tailwindcss()", /@tailwindcss\/vite/)).toBe("export default { plugins: [rivetRouter()] };\n");
  });

  test("router options", () => {
    expect(setRouterOption(config, "mode", undefined)).toContain("plugins: [rivetRouter()]");
    expect(setRouterOption("rivetRouter()", "styles", '["a.css"]')).toBe('rivetRouter({ styles: ["a.css"] })');
    expect(setRouterOption('rivetRouter({ styles: ["a.css"] })', "mode", '"static"')).toBe('rivetRouter({ mode: "static", styles: ["a.css"] })');
    expect(() => setRouterOption("rivetRouter(options)", "mode", '"static"')).toThrow(/not an object literal/);
    expect(() => setRouterOption("rivet()", "mode", '"static"')).toThrow(/no rivetRouter/);
  });
});
