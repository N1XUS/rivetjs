// Document prefetch units: selectors, Speculation Rules, the document-shell wrapper, codegen / usage
// detection (unused ⇒ generated output unchanged), static hash CSP, `whenActivated`, the inline
// fallback's freshness. End to end in Chromium: `prefetch.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { documentPrefetch, prefetchSelector, prefetchTags, speculationRules, whenActivated } from "../shared/prefetch.ts";
import { FALLBACK } from "../shared/prefetch-fallback.min.ts";
import { minifiedFallback } from "../build/prefetch-script.ts";
import { generate } from "../build/codegen.ts";
import { routeTable } from "../build/routes.ts";
import { rivetRouter, routerUsage } from "../build/vite.ts";
import { hashCSP } from "../adapters/static.ts";
import type { DocumentInput } from "../server/render.ts";

const SAME_TAB = ":not([download],[target]:not([target=_self]))";

test("prefetchSelector: marked links, app default, routed apps take reload / external links (paths: the rules' job)", () => {
  assert.equal(prefetchSelector("document"), `:is(a[data-rivet-prefetch=document])[href]${SAME_TAB}`);
  assert.equal(prefetchSelector("prerender", { default: "document" }), `:is(a[data-rivet-prefetch=prerender])[href]${SAME_TAB}`);
  assert.equal(
    prefetchSelector("document", { default: "document", routed: true }),
    `:is(a[data-rivet-prefetch=document],a:not([data-rivet-prefetch]))[href]:is([data-rivet-reload],[rel~=external])${SAME_TAB}`,
  );
  // With the route paths, links of unmatched paths count too: the selector leaves the reload filter out.
  assert.equal(
    prefetchSelector("document", { default: "document", routed: true, routes: "a\\/?|" }),
    `:is(a[data-rivet-prefetch=document],a:not([data-rivet-prefetch]))[href]${SAME_TAB}`,
  );
  assert.equal(
    prefetchSelector("all", { default: "prerender" }),
    `:is(a[data-rivet-prefetch=document],a[data-rivet-prefetch=prerender],a:not([data-rivet-prefetch]))[href]${SAME_TAB}`,
  );
});

test("speculationRules: same origin, not the page itself (URLPattern-escaped), moderate by default, no `<`", () => {
  const rules = JSON.parse(speculationRules(new URL("http://x/a:b/(c)*?q=1"), {}));
  for (const kind of ["prefetch", "prerender"]) {
    const [rule] = rules[kind];
    assert.equal(rule.source, "document");
    assert.equal(rule.eagerness, "moderate");
    assert.deepEqual(rule.where.and[0], { href_matches: "/*" });
    assert.deepEqual(rule.where.and[1], { not: { href_matches: "/a\\:b/\\(c\\)\\*{/}?" } });
  }
  assert.deepEqual(JSON.parse(speculationRules(new URL("http://x/docs/a/"), {})).prefetch[0].where.and[1], { not: { href_matches: "/docs/a{/}?" } });
  assert.deepEqual(JSON.parse(speculationRules(new URL("http://x/"), {})).prefetch[0].where.and[1], { not: { href_matches: "/" } });
  assert.doesNotMatch(prefetchTags(new URL("http://x/%3C/script%3E"), undefined), /<\/script>.*<\/script>.*<\/script>/s);
  assert.doesNotMatch(speculationRules(new URL("http://x/"), {}), /</);
});

test("speculationRules / prefetchTags with route paths: reload links or paths no route matches; the fallback gets a RegExp", () => {
  const routes = "about\\/?|blog(?:\\/[^\\/]+\\/?|\\/?)|";
  for (const kind of ["prefetch", "prerender"]) {
    const where = JSON.parse(speculationRules(new URL("http://x/about"), { routed: true, routes }))[kind][0].where;
    const href: string = where.and[3].or[1].not.href_matches;
    assert.deepEqual(where.and[3], { or: [{ selector_matches: "[data-rivet-reload],[rel~=external]" }, { not: { href_matches: "/(" + routes + ")" } }] });
    // The rule is a valid URLPattern and matches what the routes match (query / hash ignored).
    const pattern = new URLPattern(href, "http://x/");
    for (const path of ["/", "/about/", "/blog", "/blog/a?x#y"]) assert.ok(pattern.test("http://x" + path), path);
    for (const path of ["/files/a.pdf", "/blog/a/b", "/aboutx"]) assert.ok(!pattern.test("http://x" + path), path);
  }
  // Only `/` routes (empty source): every other path loads a document.
  assert.deepEqual(JSON.parse(speculationRules(new URL("http://x/a"), { routed: true, routes: "" })).prefetch[0].where.and[3].or[1], {
    not: { href_matches: "/" },
  });
  const tags = prefetchTags(new URL("http://x/"), undefined, { routed: true, routes });
  assert.ok(tags.endsWith(`(${JSON.stringify(prefetchSelector("all", { routed: true, routes }))},/^\\/(?:${routes})$/)</script>`), tags);
  // The literal's RegExp matches the same paths.
  const literal = new Function("return " + /,(\/\^.*\$\/)\)<\/script>$/.exec(tags)![1]!)() as RegExp;
  assert.ok(literal.test("/blog/x") && literal.test("/") && !literal.test("/legacy.html"));
  // Written into the page as a RegExp literal: a source that could break out of it is refused.
  for (const bad of ["a/b", "a\\\\/b", "</script>", "a\nb"])
    assert.throws(() => documentPrefetch(() => ({ start: "", end: "" }), { routes: bad }), /invalid routes/);
  assert.doesNotThrow(() => documentPrefetch(() => ({ start: "", end: "" }), { routes }));
});

test("documentPrefetch: tags before </head> with the response nonce; shells without </head> get them at the end of start", () => {
  const input = { head: undefined, nonce: 'n"1', url: new URL("http://x/p"), status: 200, styles: [] } as DocumentInput;
  const wrapped = documentPrefetch(() => ({ start: "<html><head><title>t</title></head><body>", end: "</body></html>" }), { routed: true });
  const { start, end } = wrapped(input);
  assert.equal(end, "</body></html>");
  assert.match(
    start,
    /^<html><head><title>t<\/title><script type="speculationrules" nonce="n1">\{.*<\/script><script nonce="n1">\(function\(.*<\/script><\/head><body>$/,
  );
  assert.ok(start.includes(FALLBACK + "(" + JSON.stringify(prefetchSelector("all", { routed: true })) + ")"));
  const bare = documentPrefetch(() => ({ start: "<div>", end: "</div>" }))({ ...input, nonce: undefined });
  assert.match(bare.start, /^<div><script type="speculationrules">/);
});

test("the inline fallback is the minified client/prefetch-fallback.ts (run node libs/router/build/prefetch-script.ts)", async () => {
  assert.equal(FALLBACK, await minifiedFallback(), "stale shared/prefetch-fallback.min.ts");
  assert.ok(FALLBACK.length < 1400, String(FALLBACK.length));
});

test("hashCSP allows the speculation rules by hash", () => {
  const rules = '{"prefetch":[]}';
  const out = hashCSP(`<html><head></head><body><script type="speculationrules">${rules}</script></body></html>`);
  assert.ok(out.includes(`'sha256-${createHash("sha256").update(rules).digest("base64")}'`), out);
});

const table = routeTable(["index.tsx", "about.tsx"]);
test("codegen: prefetch wraps the document shell; unset leaves entry.server.tsx unchanged", () => {
  const plain = generate(table, { routesDir: "src/routes", document: "src/document.ts" }).files["entry.server.tsx"]!;
  assert.match(plain, /export \{ default as document \} from "\.\.\/src\/document\.ts";/);
  assert.doesNotMatch(plain, /prefetch/);
  assert.equal(generate(table, { routesDir: "src/routes", document: "src/document.ts", prefetch: false }).files["entry.server.tsx"], plain);
  const on = generate(table, { routesDir: "src/routes", document: "src/document.ts", prefetch: "prerender" }).files["entry.server.tsx"]!;
  assert.match(on, /import shell from "\.\.\/src\/document\.ts";/);
  assert.match(on, /export const document = documentPrefetch\(shell, \{"default":"prerender","routed":true,"routes":"about\\\\\/\?\|"\}\);/);
  // One static route: links are full loads anyway (no client router), so every marked link counts.
  const single = generate(routeTable(["index.tsx"]), { routesDir: "src/routes", document: "src/document.ts", prefetch: true }).files["entry.server.tsx"]!;
  assert.match(single, /documentPrefetch\(shell, \{\}\)/);
  // The client side is unaffected.
  const app = generate(table, { routesDir: "src/routes", document: "src/document.ts" }).files["app.tsx"];
  assert.equal(generate(table, { routesDir: "src/routes", document: "src/document.ts", prefetch: true }).files["app.tsx"], app);
});

test("routerUsage detects prefetch marks; rivetRouter validates the option", async () => {
  const app = await mkdtemp(join(tmpdir(), "rivet-prefetch-"));
  try {
    await mkdir(join(app, "src/routes"), { recursive: true });
    await writeFile(join(app, "src/routes/index.tsx"), `import { Link } from "@rivetjs/router/link";\nexport default () => <Link to="/" prefetch="none" />;\n`);
    assert.equal((await routerUsage(app)).prefetch, false);
    await writeFile(
      join(app, "src/routes/a.tsx"),
      `import { Link } from "@rivetjs/router/link";\nexport default () => <Link to="/" reload prefetch={"prerender"} />;\n`,
    );
    assert.equal((await routerUsage(app)).prefetch, true);
    await rm(join(app, "src/routes/a.tsx"));
    await writeFile(join(app, "src/routes/b.tsx"), `import "@rivetjs/router";\nexport default () => <a href="/x" data-rivet-prefetch="document" />;\n`);
    assert.equal((await routerUsage(app)).prefetch, true);
  } finally {
    await rm(app, { recursive: true, force: true });
  }
  assert.throws(() => rivetRouter({ prefetch: "eager" as never }), /prefetch must be a boolean, "document" or "prerender"/);
});

test("prefetchEagerness: rules eagerness, emitted by codegen only when not moderate, validated", () => {
  for (const eagerness of ["conservative", "moderate", "eager"] as const) {
    const rules = JSON.parse(speculationRules(new URL("http://x/"), { eagerness }));
    assert.equal(rules.prefetch[0].eagerness, eagerness);
    assert.equal(rules.prerender[0].eagerness, eagerness);
  }
  const base = { routesDir: "src/routes", document: "src/document.ts", prefetch: "document" } as const;
  const plain = generate(table, base).files["entry.server.tsx"];
  assert.equal(generate(table, { ...base, prefetchEagerness: "moderate" }).files["entry.server.tsx"], plain);
  assert.match(
    generate(table, { ...base, prefetchEagerness: "conservative" }).files["entry.server.tsx"]!,
    /documentPrefetch\(shell, \{"default":"document","routed":true,"routes":"about\\\\\/\?\|","eagerness":"conservative"\}\);/,
  );
  // Without prefetch the entry stays the plain shell re-export.
  assert.doesNotMatch(
    generate(table, { routesDir: "src/routes", document: "src/document.ts", prefetchEagerness: "eager" }).files["entry.server.tsx"]!,
    /eager/,
  );
  assert.equal(rivetRouter({ prefetch: true, prefetchEagerness: "eager" }).length > 0, true);
  assert.throws(() => rivetRouter({ prefetchEagerness: "immediate" as never }), /prefetchEagerness must be "conservative", "moderate" or "eager"/);
});

test("prefetchPaths: false drops the route-path RegExp from the document call, default keeps it, validated", () => {
  const base = { routesDir: "src/routes", document: "src/document.ts", prefetch: "document" } as const;
  assert.match(generate(table, base).files["entry.server.tsx"]!, /"routed":true,"routes":/);
  assert.equal(generate(table, { ...base, prefetchPaths: true }).files["entry.server.tsx"], generate(table, base).files["entry.server.tsx"]);
  const off = generate(table, { ...base, prefetchPaths: false }).files["entry.server.tsx"]!;
  assert.match(off, /documentPrefetch\(shell, \{"default":"document","routed":true\}\);/);
  // Without routes, a routed app's rules select only reload / external links.
  const rules = JSON.parse(speculationRules(new URL("http://x/"), { routed: true }));
  assert.equal(JSON.stringify(rules).includes("[data-rivet-reload]"), true);
  assert.equal(rivetRouter({ prefetch: "document", prefetchPaths: false }).length > 0, true);
  assert.throws(() => rivetRouter({ prefetchPaths: "no" as never }), /prefetchPaths must be a boolean/);
});

test("whenActivated: runs now, or after prerenderingchange on a prerendered page", () => {
  const saved = globalThis.document;
  try {
    let listener: (() => void) | undefined;
    const doc = { prerendering: true, addEventListener: (type: string, fn: () => void) => type === "prerenderingchange" && (listener = fn) };
    (globalThis as { document?: unknown }).document = doc;
    let runs = 0;
    whenActivated(() => runs++);
    assert.equal(runs, 0);
    doc.prerendering = false;
    listener!();
    assert.equal(runs, 1);
    whenActivated(() => runs++);
    assert.equal(runs, 2);
  } finally {
    (globalThis as { document?: unknown }).document = saved;
  }
});
