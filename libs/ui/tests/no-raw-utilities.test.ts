// Component sources must only use component classes: the vendored / Rivet-authored BEM classes of `libs/ui/styles`
// (ui) or the default `rv-*` / Angular CDK `cdk-*` classes (cdk). Tailwind in an app never scans the package sources,
// so a raw utility (`sr-only`, `flex`, `size-4` …) written in a component is never generated: the sidebar trigger's
// `sr-only` label rendered visibly over the menu (2026-10-08). Behaviour-critical styles are inline (cdk rule).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const SKIP_DIRS = new Set(["node_modules", "tests", "tests-components", "dist", ".artifacts", "app"]);

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(path, ext, out);
    } else if (ext.test(name)) out.push(path);
  }
  return out;
}

/** String literals in class positions: `class="…"`, `xClass="…"`, `class={"…"}`, `class: "…"`, `xClass: "…"`, tv slot / variant values. */
const CLASS_LITERAL = /\b(?:class|[a-z]+Class)\s*(?:=\s*\{?|:\s*)(["'`])([^"'`$]*)\1/g;

function classTokens(file: string): { token: string; line: number }[] {
  // Comments out (line numbers kept): doc examples are not component markup.
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ""))
    .replace(/(^|\s)\/\/.*$/gm, "$1");
  const tokens: { token: string; line: number }[] = [];
  for (const match of source.matchAll(CLASS_LITERAL)) {
    const line = source.slice(0, match.index).split("\n").length;
    for (const token of match[2]!.split(/\s+/)) if (token) tokens.push({ token, line });
  }
  return tokens;
}

/** Every class selector defined by the ui stylesheets (vendored + Rivet-authored). */
function definedClasses(): Set<string> {
  const defined = new Set<string>();
  for (const file of walk(join(ROOT, "libs/ui/styles"), /\.css$/)) {
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) defined.add(m[1]!);
  }
  return defined;
}

describe("no raw Tailwind utilities in component sources", () => {
  test("@rivetjs/ui components use only classes defined in libs/ui/styles", () => {
    const defined = definedClasses();
    const files = [...walk(join(ROOT, "libs/ui/src"), /\.tsx?$/), ...walk(join(ROOT, "libs/ui/styles/src"), /\.ts$/)];
    const bad = files.flatMap((file) =>
      classTokens(file)
        .filter(({ token }) => !defined.has(token))
        .map(({ token, line }) => `${relative(ROOT, file)}:${line} ${token}`),
    );
    expect(bad).toEqual([]);
  });

  test("@rivetjs/cdk components use only default rv-* (or Angular CDK cdk-*) classes", () => {
    const files = walk(join(ROOT, "libs/cdk"), /\.tsx?$/);
    const bad = files.flatMap((file) =>
      classTokens(file)
        .filter(({ token }) => !/^(rv-|cdk-)/.test(token))
        .map(({ token, line }) => `${relative(ROOT, file)}:${line} ${token}`),
    );
    expect(bad).toEqual([]);
  });

  test("the scanner sees a raw utility", () => {
    expect([...`<span class="sr-only">x</span>`.matchAll(CLASS_LITERAL)].map((m) => m[2])).toEqual(["sr-only"]);
  });
});
