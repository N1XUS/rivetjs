// T5 ownership (spec §4.1): suffixes, `@jsxImportSource` pragma, `include` folders / npm specifiers, `exclude`, and
// RV2145 for a module two bridges claim. The Rivet side (an explicit `rivet({ include })` claiming a bridge module) is
// in libs/compiler/tests/vite-bridges.test.ts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { isPackageName, jsxImportSource, ownerOf, ownership, ownsSpecifier, specifierOwner } from "../ownership.ts";
import type { BridgeEntry } from "@rivetjs/compiler/vite";

const root = "/app";
const entry = (name: string, rules: Parameters<typeof ownership>[0]): BridgeEntry => {
  const own = ownership(rules);
  own.configure({ root });
  return { name, owns: own.owns, specifiers: own.specifiers, plugins: () => [], server: name + "/server", client: name + "/client" };
};
const react = entry("react", {
  name: "react",
  suffixes: [".react.tsx", ".react.jsx"],
  pragma: ["react"],
  include: ["src/widgets/**", "@mui/material", /legacy\/.*\.jsx$/],
  exclude: ["src/widgets/rivet/**"],
});
const preact = entry("preact", { name: "preact", suffixes: [".preact.tsx", ".preact.jsx"], pragma: ["preact"] });
const vue = entry("vue", { name: "vue", suffixes: [".vue"] });

test("ownership matrix: suffix, pragma, include glob / RegExp, exclude, everything else Rivet", () => {
  const cases: [string, string | undefined, string | null][] = [
    ["/app/src/Counter.react.tsx", undefined, "react"],
    ["/app/src/Counter.react.jsx", undefined, "react"],
    ["/app/src/Card.preact.tsx", undefined, "preact"],
    ["/app/src/Chart.vue", undefined, "vue"],
    ["/app/src/page.tsx", "export const x = 1;", null],
    ["/app/src/page.tsx", "/** @jsxImportSource react */\nexport const x = 1;", "react"],
    ["/app/src/page.tsx", "// @jsxImportSource preact\nexport const x = 1;", "preact"],
    ["/app/src/page.tsx", "/** @jsxImportSource @rivetjs/runtime */\nexport const x = 1;", null],
    ["/app/src/page.tsx", "const a = 1; /** @jsxImportSource react */", null],
    ["/app/src/widgets/Chart.tsx", undefined, "react"],
    ["/app/src/widgets/rivet/Native.tsx", undefined, null],
    ["/app/legacy/old.jsx", undefined, "react"],
    ["/app/src/Counter.react.tsx?v=1", undefined, "react"],
    ["\0rivet-island:/app/src/Counter.react.tsx.tsx", undefined, null],
  ];
  for (const [file, source, expected] of cases) assert.equal(ownerOf([react, preact, vue], root, file, source)?.name ?? null, expected, file + " " + source);
});

test("npm packages by import specifier (subpaths too); folders are globs", () => {
  assert.deepEqual(react.specifiers, ["@mui/material"]);
  assert.ok(ownsSpecifier(react, "@mui/material"));
  assert.ok(ownsSpecifier(react, "@mui/material/Button"));
  assert.ok(!ownsSpecifier(react, "@mui/materials"));
  assert.equal(specifierOwner([react, preact], "@mui/material/Button")?.name, "react");
  assert.equal(specifierOwner([react, preact], "lodash"), null);
  for (const name of ["recharts", "@mui/material", "react-dom"]) assert.ok(isPackageName(name), name);
  for (const glob of ["src/react/**", "./widgets", "/abs/x", "src/*.tsx"]) assert.ok(!isPackageName(glob), glob);
  assert.equal(jsxImportSource("#!/usr/bin/env node\n/* @jsxImportSource solid-js */"), "solid-js");
  assert.equal(jsxImportSource("/** @jsx h */"), null);
});

test("RV2145: a module two bridges claim names both owners", () => {
  const both = entry("preact", { name: "preact", suffixes: [".preact.tsx"], include: ["src/widgets/**"] });
  assert.throws(
    () => ownerOf([react, both], root, "/app/src/widgets/Chart.tsx"),
    (error: Error & { pluginCode?: string }) => {
      assert.equal(error.pluginCode, "RV2145");
      assert.equal(error.message, "[RV2145] src/widgets/Chart.tsx matches both react({ include }) and preact({ include }) — pick one owner");
      return true;
    },
  );
  const npm = entry("preact", { name: "preact", suffixes: [], include: ["@mui/material"] });
  assert.throws(() => specifierOwner([react, npm], "@mui/material/Button"), /RV2145.*@mui\/material\/Button.*react.*preact/);
});
