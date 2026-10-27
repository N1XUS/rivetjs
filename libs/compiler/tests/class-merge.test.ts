// tailwind-merge on demand (`class-merge.ts`, ZERO UI-JS2): which modules can hand a variant resolver a class override
// tailwind-merge would change (they import `@rivetjs/ui/tv-merge` in production client builds; the rest ship no merge).
import { afterAll, beforeAll, test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";
import { cn } from "tailwind-variants";
import { classJoinDeclarations, classModuleInfo, classOverrideSites, classPropUse, type ClassPropTarget } from "../class-merge.ts";
import { rivet } from "../vite.ts";

const merge = (value: string) => cn(value) as string;
const why = (code: string, file = "/app/page.tsx", joins?: Map<string, number[]>) => classOverrideSites(code, file, { merge, joins }).map((site) => site.why);

test("literals: one token, fixed points and BEM pass; a literal tailwind-merge changes is a source", () => {
  assert.deepEqual(why(`import { Card } from "@rivetjs/ui"; export const A = () => <Card class="w-96" />;`), []);
  assert.deepEqual(why(`import { Card } from "@rivetjs/ui"; export const A = () => <Card class="w-96 p-4 rounded-xl" />;`), []);
  // irregular whitespace: the merge normalises it, so the scanner keeps it a source (conservative)
  assert.deepEqual(why(`import { Card } from "@rivetjs/ui"; export const A = () => <Card class={"w-96\\n  p-4"} />;`), ["<Card> class"]);
  assert.deepEqual(why(`import { Card } from "@rivetjs/ui"; export const A = () => <Card class="w-96 w-full" />;`), ["<Card> class"]);
  assert.deepEqual(why(`import { Card } from "@rivetjs/ui"; export const A = () => <Card class="p-2 p-2" />;`), ["<Card> class"]);
  assert.deepEqual(why(`export const o = { class: "px-2 px-4" };`, "/app/o.ts"), ["{ class }"]);
  assert.deepEqual(why(`export const o = { className: "card card--x" };`, "/app/o.ts"), []);
});

test("values: transports, consts, conditionals pass; calls, templates with values and two utility parts are sources", () => {
  const card = (expr: string, pre = "") => why(`import { Card } from "./card.tsx"; ${pre} export const A = (props) => <Card class={${expr}} />;`);
  assert.deepEqual(card("props.class"), []);
  assert.deepEqual(card("props.classNames?.base"), []);
  assert.deepEqual(card(`props.on ? "bg-accent text-white" : "bg-default"`), []);
  assert.deepEqual(card(`props.on && "bg-accent"`), []);
  assert.deepEqual(card(`C`, `const C = "w-full max-w-sm";`), []);
  assert.deepEqual(card(`C`, `const C = "w-full w-96";`), ["<Card> class"]);
  assert.deepEqual(card(`cx("card__x", props.class)`, `import { cx } from "@rivetjs/ui";`), []);
  assert.deepEqual(card(`cx("w-full", props.class)`, `import { cx } from "@rivetjs/ui";`), ["<Card> class"]);
  assert.deepEqual(card("pick(props)"), ["<Card> class"]);
  assert.deepEqual(card("`w-full ${props.size}`"), ["<Card> class"]);
  assert.deepEqual(card("(state) => state.on ? 'a b' : 'c'"), []);
  assert.deepEqual(card("(state) => pick(state)"), ["<Card> class"]);
  // the same tag with `class` and `className` utilities: the resolver joins them
  assert.deepEqual(why(`import { Card } from "./card.tsx"; export const A = () => <Card class="w-96" className="p-4" />;`), ["<Card> class + className"]);
  // `classNames`: each slot's value on its own
  assert.deepEqual(why(`import { S } from "./s.tsx"; export const A = () => <S classNames={{ base: "p-4 m-2", title: "text-lg" }} />;`), []);
  assert.deepEqual(why(`import { S } from "./s.tsx"; export const A = (p) => <S classNames={{ base: p.x() }} />;`), ["<S> classNames"]);
});

test("rendering tags are no origins: intrinsic, @rivetjs/* other than ui, ui's dom / vendor primitives", () => {
  assert.deepEqual(why(`export const A = (p) => <div class={pick(p)} />;`), []);
  assert.deepEqual(why(`import { Button } from "@rivetjs/cdk/button"; export const A = (p) => <Button class={pick(p)} />;`), []);
  assert.deepEqual(why(`import { dom } from "../../utils/dom.tsx"; export const A = (p) => <dom.div class={pick(p)} />;`), []);
  assert.deepEqual(why(`import { Button } from "@rivetjs/ui/button"; export const A = (p) => <Button class={pick(p)} />;`), ["<Button> class"]);
  // a nested resolver call inside a rendering tag's value is still checked
  assert.deepEqual(why(`import { s } from "./x.styles.ts"; export const A = (p) => <div class={s({ class: pick(p) })} />;`), ["{ class }"]);
});

test("scopes: a parameter shadowing a const is unknown; destructured class props forward", () => {
  assert.deepEqual(why(`import { Card } from "./card.tsx"; const cls = "a"; export const A = (cls) => <Card class={cls} />;`), ["<Card> class"]);
  assert.deepEqual(
    why(`import { Card } from "./card.tsx"; export const A = (props) => { const { class: cls, ...rest } = props; return <Card class={cls} />; };`),
    [],
  );
  assert.deepEqual(why(`import { Card } from "./card.tsx"; export const A = (props) => { let cls = props.class; return <Card class={cls} />; };`), [
    "<Card> class",
  ]);
});

test("resolvers: styles-module chains (B without an override), memo helpers, declared joins and resolvers", () => {
  const head = `import { cardVariants } from "../../styles/src/components/card/index.ts"; import { Button } from "../button/button.tsx";`;
  assert.deepEqual(why(`${head} const S = cardVariants(); export const A = (p) => <Button class={cx(S.base(), p.class)} />;`), []);
  // two resolver results that may each carry an override: a source
  assert.deepEqual(why(`${head} const S = cardVariants(); export const A = (p) => <Button class={cx(S.base({ class: p.class }), p.extra.class)} />;`), [
    "<Button> class",
  ]);
  assert.deepEqual(
    why(
      `${head} const M = {}; const slotsFor = (v) => (M[v] ??= cardVariants({ v })); export const A = (p) => <Button class={cx(slotsFor(p.v).base(), p.class)} />;`,
    ),
    [],
  );
  // declared joins (`@rivet-class-join`, read from the helper's module) and resolvers (`@rivet-class-resolvers`)
  const joins = classJoinDeclarations(`// @rivet-class-join composeSlotClassName(1) composeTwRenderProps(0,1)\n`);
  assert.deepEqual(joins.get("composeTwRenderProps"), [0, 1]);
  assert.deepEqual(why(`${head} export const A = (p) => <Button class={composeTwRenderProps(p.class, "card__x")} />;`, "/x.tsx", joins), []);
  assert.deepEqual(why(`${head} export const A = (p) => <Button class={composeTwRenderProps(p.class, "w-full")} />;`, "/x.tsx", joins), ["<Button> class"]);
  assert.deepEqual(
    why(
      `${head} // @rivet-class-resolvers slots\nconst slots = (c) => cache(c); export const A = (p) => <Button class={composeTwRenderProps(p.class, slots(p)?.trigger())} />;`,
      "/x.tsx",
      joins,
    ),
    [],
  );
  // a declared join's own body is trusted
  assert.deepEqual(why(`// @rivet-class-join wrap(0)\nexport const wrap = (c) => ({ class: pick(c) });`, "/w.ts"), []);
});

test("prop merges joining two origins' classes are a source once the module forwards a class", () => {
  assert.deepEqual(why(`import { Card } from "./card.tsx"; export const A = (p) => <Card {...mergeProps(ctx, p)} class={p.class} />;`), [
    "prop merge + forwarded class",
  ]);
  assert.deepEqual(why(`import { Card } from "./card.tsx"; export const A = (p) => <Card {...mergeProps(ctx, p)} />;`), []);
});

test("local components that only render a class prop on intrinsic elements are no origins", () => {
  const head = `function Head(props) { const api = props.api; return <div class={props.classNames.toolbar}><h2 class={props.classNames.title}>{api.t}</h2></div>; }`;
  assert.deepEqual(why(`${head} export const A = (p) => <Head api={p.api} classNames={pick(p)} />;`), []);
  // the prop reaches a component (it may resolve it), is read whole, or is read by key: still a source
  const resolves = `import { Card } from "./card.tsx"; function Head(props) { return <Card class={props.classNames.toolbar} />; }`;
  assert.deepEqual(why(`${resolves} export const A = (p) => <Head classNames={pick(p)} />;`), ["<Head> classNames"]);
  const whole = `function Head(props) { return <div class={props.classNames.toolbar}>{f(props)}</div>; }`;
  assert.deepEqual(why(`${whole} export const A = (p) => <Head classNames={pick(p)} />;`), ["<Head> classNames"]);
});

test("prop joins: a join of forwarded class props of an exported component is conditional on its callers", () => {
  const sites = (code: string) => classOverrideSites(code, "/ui/s.tsx", { merge });
  const join = `[local.classNames?.base, local.class].filter(Boolean).join(" ")`;
  const comp = (body: string) =>
    `import { s } from "./s.styles.ts"; import { splitLive } from "../../utils/live.tsx"; export function S(props) { const [local, rest] = splitLive(props, ["class", "classNames"]); return <X class={s({ class: ${body} })} />; }`;
  assert.deepEqual(sites(comp(join))[0]!.conditional, { component: "S", props: [["classNames", "base"], ["class"]] });
  assert.deepEqual(sites(comp(`cx(local.class, "card__x", props.classNames?.base)`))[0]!.conditional, {
    component: "S",
    props: [["class"], ["classNames", "base"]],
  });
  // not a join of props only, or the component is used in its own module: an unconditional source
  assert.equal(sites(comp(`[local.class, pick()].filter(Boolean).join(" ")`))[0]!.conditional, undefined);
  assert.equal(sites(comp(`[local.class, "w-full"].filter(Boolean).join(" ")`))[0]!.conditional, undefined);
  assert.equal(sites(comp(join) + ` export const T = () => <S />;`)[0]!.conditional, undefined);
  // names that are no references: an import's imported name, a member, a key, a type
  const named = `import { S as Prim } from "@rivetjs/cdk/s"; type P = typeof S; const o = { S: 1 }; o.S; ` + comp(join);
  assert.deepEqual(sites(named)[0]!.conditional, { component: "S", props: [["classNames", "base"], ["class"]] });
  const info = classModuleInfo(comp(join) + ` export { S as Sched }; export * from "./t.ts"; export { U } from "./u.ts";`, "/ui/s.tsx", { merge });
  assert.equal(info.hard, false);
  assert.deepEqual([...info.conditional.keys()], ["S", "Sched"]);
  assert.deepEqual(info.stars, ["./t.ts"]);
  assert.deepEqual(info.reexports, [{ exported: "U", from: "./u.ts", imported: "U" }]);
});

test("prop joins at call sites: two joined props passed, a spread or a value use need the merge", () => {
  const sets = [[["classNames", "base"], ["class"]]];
  const targets = new Map<string, ClassPropTarget>([["S", { sets }]]);
  const use = (code: string, t = targets) => [...classPropUse(`import { S } from "@rivetjs/ui/s"; ${code}`, "/app/a.tsx", t, { merge })];
  assert.deepEqual(use(`export const A = () => <S events={[]} />;`), []);
  assert.deepEqual(use(`export const A = () => <S class="w-96 p-4" />;`), []);
  assert.deepEqual(use(`export const A = () => <S class="w-96" classNames={{ title: "p-2" }} />;`), []);
  assert.deepEqual(use(`export const A = () => <S class="card card--x" classNames={{ base: "p-2" }} />;`), [], "BEM-only class: no utility to merge");
  assert.deepEqual(use(`export const A = () => <S class="w-96" classNames={{ base: "p-2" }} />;`), ["S"]);
  assert.deepEqual(use(`export const A = (p) => <S class={p.class} classNames={p.classNames} />;`), ["S"]);
  assert.deepEqual(use(`export const A = (p) => <S {...p} />;`), ["S"]);
  assert.deepEqual(use(`export const A = (p) => h(S, p);`), ["S"]);
  assert.deepEqual(use(`export type P = Parameters<typeof S>[0]; export const A = () => <S />;`), [], "type uses are no values");
  const ns = new Map<string, ClassPropTarget>([["UI", { members: (name) => (name === "S" ? sets : null) }]]);
  const nsUse = (code: string) => [...classPropUse(`import * as UI from "@rivetjs/ui"; ${code}`, "/app/a.tsx", ns, { merge })];
  assert.deepEqual(nsUse(`export const A = () => <UI.S class="w-96" />;`), []);
  assert.deepEqual(nsUse(`export const A = () => <UI.S class="w-96" classNames={{ base: "p-2" }} />;`), ["UI.S"]);
  assert.deepEqual(nsUse(`export const A = () => <UI.Card class="w-96" />;`), []);
  assert.deepEqual(nsUse(`export const A = () => f(UI.S);`), ["UI.S"]);
  assert.deepEqual(nsUse(`export const A = () => f(UI);`), ["UI.*"]);
});

// --- build: the provider import lands only in flagged client modules ------------------------------------------------

const here = fileURLToPath(new URL(".", import.meta.url));
let root = "";
beforeAll(async () => {
  // Inside the workspace: `@rivetjs/ui/tv-merge` and tailwind-variants resolve like an app's.
  root = await mkdtemp(join(here, ".class-merge-"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "class-merge-fixture", type: "module", dependencies: { "@rivetjs/ui": "*" } }));
  await writeFile(join(root, "plain.ts"), `export const plain = { class: "w-full max-w-sm" };\n`);
  await writeFile(join(root, "risky.ts"), `export const risky = (p: { a: string }) => ({ class: [p.a, "w-96"].join(" ") });\n`);
  await writeFile(join(root, "main.ts"), `import { plain } from "./plain.ts";\nimport { risky } from "./risky.ts";\nconsole.log(plain, risky({ a: "x" }));\n`);
  // Prop joins: `sched.tsx` joins `classNames.base` + `class`; `one.tsx` passes one of them, `two.tsx` both.
  await writeFile(join(root, "s.styles.ts"), `export const s = (o: { class?: string }) => "sched " + (o.class ?? "");\n`);
  await writeFile(
    join(root, "sched.tsx"),
    `import { s } from "./s.styles.ts";\nconst splitLive = (p: any, k: string[]) => [p, p];\n` +
      `export function Sched(props: { class?: string; classNames?: { base?: string } }) {\n  const [local] = splitLive(props, ["class", "classNames"]);\n` +
      `  return <div class={s({ class: [local.classNames?.base, local.class].filter(Boolean).join(" ") })} />;\n}\n`,
  );
  await writeFile(join(root, "index.ts"), `export * from "./sched.tsx";\n`);
  await writeFile(join(root, "one.tsx"), `import { Sched } from "./index.ts";\nexport const One = () => <Sched class="w-96 p-4" />;\nconsole.log(One);\n`);
  await writeFile(
    join(root, "two.tsx"),
    `import { Sched } from "./index.ts";\nexport const Two = () => <Sched class="w-96" classNames={{ base: "p-2" }} />;\nconsole.log(Two);\n`,
  );
});
afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

test("build: a flagged module imports the provider (client), an inert one does not; the server build never", async () => {
  const run = async (ssr: boolean) => {
    const out = (await build({
      root,
      logLevel: "silent",
      configFile: false,
      plugins: [rivet()],
      build: {
        write: false,
        minify: false,
        ssr: ssr ? join(root, "main.ts") : undefined,
        rollupOptions: ssr ? {} : { input: join(root, "main.ts"), preserveEntrySignatures: "strict" },
      },
    })) as Rollup.RollupOutput | Rollup.RollupOutput[];
    const outputs = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output);
    return outputs
      .filter((o): o is Rollup.OutputChunk => o.type === "chunk")
      .map((c) => c.code)
      .join("\n");
  };
  const client = await run(false);
  assert.match(client, /provideMerge|ui tv/, "the provider (and tv.ts) are bundled");
  assert.match(client, /twMerge|mergeString/, "tailwind-merge ships with the flagged module");
  const server = await run(true);
  assert.doesNotMatch(server, /provideMerge/, "server builds merge always (`#tv-merge` = merge-on), no provider import");
});

test("build: prop joins drop the provider in pass 2 of a co-load build when no caller passes two joined props", async () => {
  const run = async (entry: string, dir: string | null) => {
    const before = process.env.RIVET_COLOAD;
    if (dir) process.env.RIVET_COLOAD = dir;
    else delete process.env.RIVET_COLOAD;
    try {
      const out = (await build({
        root,
        logLevel: "silent",
        configFile: false,
        plugins: [rivet()],
        build: { write: false, minify: false, rollupOptions: { input: join(root, entry), preserveEntrySignatures: "strict" } },
      })) as Rollup.RollupOutput | Rollup.RollupOutput[];
      return (Array.isArray(out) ? out : [out])
        .flatMap((o) => o.output)
        .filter((o): o is Rollup.OutputChunk => o.type === "chunk")
        .map((c) => c.code)
        .join("\n");
    } finally {
      if (before === undefined) delete process.env.RIVET_COLOAD;
      else process.env.RIVET_COLOAD = before;
    }
  };
  const merged = /provideMerge|ui tv/;
  // One pass (no co-load dir): a prop join is a source.
  assert.match(await run("one.tsx", null), merged);
  for (const [entry, needed] of [
    ["one.tsx", false],
    ["two.tsx", true],
  ] as const) {
    const dir = await mkdtemp(join(root, "coload-"));
    assert.match(await run(entry, dir), merged, "pass 1 merges as before");
    const facts = JSON.parse(await readFile(join(dir, "class-joins.json"), "utf8")) as { joins: string[]; needed: string[]; all: boolean };
    assert.deepEqual(facts.joins, ["sched.tsx"]);
    assert.deepEqual(facts.needed, needed ? ["sched.tsx"] : []);
    (needed ? assert.match : assert.doesNotMatch)(await run(entry, dir), merged, `pass 2 (${entry})`);
  }
});
