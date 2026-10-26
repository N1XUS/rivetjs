// tailwind-merge on demand (`class-merge.ts`, ZERO UI-JS2): which modules can hand a variant resolver a class override
// tailwind-merge would change (they import `@rivetjs/ui/tv-merge` in production client builds; the rest ship no merge).
import { afterAll, beforeAll, test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";
import { cn } from "tailwind-variants";
import { classJoinDeclarations, classOverrideSites } from "../class-merge.ts";
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
