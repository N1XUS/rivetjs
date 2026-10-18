// Spike P1 (docs/design/research/2026-10-18-backend-agnostic.md §6): how much of the repo's component server renders
// fit a portable template IR? A syntactic classifier over the TypeScript AST (no Rust, no type info): per PascalCase
// component (function declaration / const arrow containing JSX) it walks the body OUTSIDE client code (event handler
// attributes, `clientEffect` / `clientEvent` / `effect` / `onCleanup` callbacks, `ref` callbacks) and records every
// construct the first-cut subset (§3 of the note) does not cover. Tiers: `portable` (nothing recorded), `sidecar`
// (something recorded), `browser` (`clientOnly` / island). Local helper functions are followed (fixpoint per file).
//
//   node libs/compiler/spikes/portability/classify.ts [--roots libs/cdk,libs/ui,…] [--top 12] [--json out.json]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const argv = process.argv.slice(2);
const opt = (name: string, def: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1]! : def);
const roots = opt(
  "--roots",
  "libs/cdk,libs/ui,libs/kit,libs/forms,libs/motion,libs/docs-kit,apps/docs,apps/ui-docs,apps/cdk-docs,apps/playground,apps/bridge-demo/rivet,templates,apps/editorial-bench,apps/island-bench,apps/resume-bench/lanes/rivet",
).split(",");
const top = Number(opt("--top", "12"));
// --allow a,b,… : constructs (as reported, e.g. `call:splitLive`, `member:class`, `throw`, `new:Error`) treated as part of
// the executor helper set — measures how portable a package becomes once its named JS core is covered.
const allow = new Set(opt("--allow", "").split(",").filter(Boolean));
const SKIP = new Set(["node_modules", "dist", ".build", ".rivet", "tests", "tests-components", "tests-fuzz", "__tests__", "spikes", "oracle"]);

// Runtime / data calls the IR covers (callee identifier or member name).
const CALL_OK = new Set([
  "signal",
  "computed",
  "createId",
  "useContext",
  "createContext",
  "untrack",
  "batch",
  "t",
  "css",
  "cx",
  "mergeProps",
  "splitProps",
  "String",
  "Number",
  "Boolean",
  "Array",
  "Object",
  "Math",
  "JSON",
  "Intl",
  "renderSlot",
  "isSlot",
  "slotText",
  "children",
]);
const MEMBER_OK = new Set([
  "map",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "includes",
  "join",
  "slice",
  "toLowerCase",
  "toUpperCase",
  "trim",
  "startsWith",
  "endsWith",
  "indexOf",
  "some",
  "every",
  "flatMap",
  "flat",
  "concat",
  "at",
  "padStart",
  "padEnd",
  "toFixed",
  "toLocaleString",
  "toLocaleDateString",
  "toLocaleTimeString",
  "toString",
  "keys",
  "values",
  "entries",
  "from",
  "isArray",
  "min",
  "max",
  "round",
  "floor",
  "ceil",
  "abs",
  "stringify",
  "charAt",
  "split",
  "repeat",
  "localeCompare",
  "sort",
  "toSorted",
  "reverse",
  "toReversed",
  "reduce",
  "has",
  "get",
  "size",
  "length",
  "assign",
  "fromEntries",
  "freeze",
  "entries",
  "call",
  "apply",
  "bind",
  "format",
  "formatToParts",
  "select",
  "formatRange",
  "resolvedOptions",
]);
const CLIENT_CALLS = new Set([
  "clientEffect",
  "clientEvent",
  "onCleanup",
  "effect",
  "createEffect",
  "renderEffect",
  "onMount",
  "setTimeout",
  "setInterval",
  "requestAnimationFrame",
  "requestIdleCallback",
  "queueMicrotask",
  "addEventListener",
]);
const BROWSER_GLOBALS = new Set([
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "location",
  "history",
  "matchMedia",
  "ResizeObserver",
  "IntersectionObserver",
  "MutationObserver",
  "requestAnimationFrame",
]);

interface Report {
  file: string;
  name: string;
  tier: "portable" | "sidecar" | "browser";
  constructs: string[];
}

function* tsxFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    const st = statSync(path);
    if (st.isDirectory()) yield* tsxFiles(path);
    else if (entry.endsWith(".tsx")) yield path;
  }
}

const isPascal = (name: string) => /^[A-Z][A-Za-z0-9]*$/.test(name);
const containsJsx = (node: ts.Node): boolean => {
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) found = true;
    else ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
};

function classifyFile(file: string): Report[] {
  const source = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  // module-level functions (helpers followed as local calls)
  const locals = new Map<string, ts.Node>();
  const components: { name: string; node: ts.Node }[] = [];
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && st.body) {
      locals.set(st.name.text, st.body);
      if (isPascal(st.name.text) && containsJsx(st.body)) components.push({ name: st.name.text, node: st.body });
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        const init = d.initializer;
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          locals.set(d.name.text, init.body);
          if (isPascal(d.name.text) && containsJsx(init.body)) components.push({ name: d.name.text, node: init.body });
        }
      }
    }
  }
  const cache = new Map<ts.Node, Set<string>>();
  const visiting = new Set<ts.Node>();

  function constructsOf(body: ts.Node): Set<string> {
    if (cache.has(body)) return cache.get(body)!;
    if (visiting.has(body)) return new Set();
    visiting.add(body);
    const out = new Set<string>();
    const walk = (n: ts.Node) => {
      // client code: handler attributes, client callbacks, ref callbacks → skipped
      if (ts.isJsxAttribute(n)) {
        const name = n.name.getText(sf);
        if (/^on[A-Z]/.test(name) || /^(window|document):/.test(name) || name === "ref") return;
      }
      if (ts.isCallExpression(n)) {
        const callee = n.expression;
        if (ts.isIdentifier(callee) && CLIENT_CALLS.has(callee.text)) {
          if (callee.text === "clientOnly") out.add("browser:clientOnly");
          return;
        }
        if (ts.isIdentifier(callee)) {
          if (callee.text === "clientOnly" || callee.text === "lazyComponent") {
            out.add(`browser:${callee.text}`);
            return;
          }
          if (!CALL_OK.has(callee.text)) {
            if (locals.has(callee.text)) for (const c of constructsOf(locals.get(callee.text)!)) out.add(c);
            else if (/^use[A-Z]/.test(callee.text)) out.add(`hook:${callee.text}`);
            else if (!isLocalBinding(callee.text, n)) out.add(`call:${callee.text}`);
            // a local binding called with no args = accessor read (signal / computed / prop getter): ok
          }
        } else if (ts.isPropertyAccessExpression(callee)) {
          const member = callee.name.text;
          const objText = callee.expression.getText(sf);
          if (/^(props|p)\b/.test(objText) || objText.endsWith("props")) {
            /* prop / slot call: ok */
          } else if (!MEMBER_OK.has(member) && !CALL_OK.has(objText)) out.add(`member:${member}`);
          if (BROWSER_GLOBALS.has(objText)) out.add(`global:${objText}`);
        } else out.add("call:dynamic");
      } else if (ts.isNewExpression(n)) {
        out.add(`new:${n.expression.getText(sf).split(/[.(<]/)[0]}`);
      } else if (ts.isRegularExpressionLiteral(n)) out.add("regex");
      else if (ts.isTaggedTemplateExpression(n)) {
        const tag = n.tag.getText(sf);
        if (!["css", "t", "html"].includes(tag)) out.add(`tagged:${tag}`);
      } else if (ts.isAwaitExpression(n)) out.add("await");
      else if (ts.isTryStatement(n)) out.add("try");
      else if (ts.isThrowStatement(n)) out.add("throw");
      else if (ts.isClassExpression(n) || ts.isClassDeclaration(n)) out.add("class");
      else if (n.kind === ts.SyntaxKind.ThisKeyword) out.add("this");
      else if (ts.isForStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n) || ts.isForInStatement(n)) out.add("imperative-loop");
      else if (ts.isForOfStatement(n)) out.add("for-of");
      else if (
        ts.isBinaryExpression(n) &&
        [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken].includes(n.operatorToken.kind) &&
        !ts.isPropertyAccessExpression(n.left)
      )
        out.add("mutation");
      else if (
        ts.isPostfixUnaryExpression(n) ||
        (ts.isPrefixUnaryExpression(n) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken))
      )
        out.add("mutation");
      else if (ts.isIdentifier(n) && BROWSER_GLOBALS.has(n.text) && !ts.isPropertyAccessExpression(n.parent)) out.add(`global:${n.text}`);
      else if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && BROWSER_GLOBALS.has(n.expression.text) && !ts.isCallExpression(n.parent))
        out.add(`global:${n.expression.text}`);
      ts.forEachChild(n, walk);
    };
    walk(body);
    visiting.delete(body);
    cache.set(body, out);
    return out;
  }
  function isLocalBinding(name: string, at: ts.Node): boolean {
    // declared as a parameter / const / let in an enclosing function of the call
    let n: ts.Node | undefined = at;
    while (n) {
      if (
        (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n)) &&
        n.parameters.some((p) => p.name.getText(sf).includes(name))
      )
        return true;
      if (ts.isBlock(n) || ts.isSourceFile(n)) {
        for (const st of n.statements)
          if (ts.isVariableStatement(st) && st.declarationList.declarations.some((d) => d.name.getText(sf).includes(name))) return true;
      }
      n = n.parent;
    }
    return false;
  }

  return components.map(({ name, node }) => {
    const constructs = [...constructsOf(node)].filter((c) => !allow.has(c));
    const tier = constructs.some((c) => c.startsWith("browser:")) ? "browser" : constructs.length ? "sidecar" : "portable";
    return { file: relative(process.cwd(), file), name, tier, constructs };
  });
}

const all: Report[] = [];
const byRoot: Record<string, Report[]> = {};
for (const root of roots) {
  byRoot[root] = [];
  try {
    for (const file of tsxFiles(root)) {
      const reports = classifyFile(file);
      byRoot[root].push(...reports);
      all.push(...reports);
    }
  } catch (e) {
    console.error(`skip ${root}: ${(e as Error).message}`);
  }
}

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)} %` : "–");
console.log(`| root | components | portable | sidecar | browser | top demoting constructs (components affected) |`);
console.log(`| --- | ---: | ---: | ---: | ---: | --- |`);
const rows = [...Object.entries(byRoot), ["**all**", all] as [string, Report[]]];
for (const [root, reports] of rows) {
  const n = reports.length;
  const count = (t: Report["tier"]) => reports.filter((r) => r.tier === t).length;
  const freq = new Map<string, number>();
  for (const r of reports)
    for (const c of new Set(r.constructs.map((c) => c.replace(/^(call|member|hook|new|global|tagged):/, "$1:")))) freq.set(c, (freq.get(c) ?? 0) + 1);
  const topList = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([c, k]) => `${c} ${k}`)
    .join(", ");
  console.log(`| ${root} | ${n} | ${pct(count("portable"), n)} | ${pct(count("sidecar"), n)} | ${pct(count("browser"), n)} | ${topList} |`);
}
const json = opt("--json", "");
if (json) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(json, JSON.stringify(all, null, 1));
}
