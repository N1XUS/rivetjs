// Compile-time icons (`static-icons.ts`): `<Icon icon={LucideImport} …/>` with constant props → inline `<svg>`
// whose server bytes equal the `Icon` component's (every lucide icon × prop sets); everything else unchanged.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as lucide from "lucide";
import { compile } from "../index.ts";
import { staticIcons } from "../static-icons.ts";
import { renderToString } from "@rivetjs/runtime/server";

const load = () => lucide as unknown as Record<string, unknown>;
const KIT = '"@rivetjs/kit/icon"';
const iconSource = await readFile(new URL("../../kit/icon.tsx", import.meta.url), "utf8");
const server = (code: string) =>
  code
    .replaceAll('"@rivetjs/runtime/server"', JSON.stringify(import.meta.resolve("@rivetjs/runtime/server")))
    .replaceAll('"@rivetjs/runtime/slot"', JSON.stringify(import.meta.resolve("@rivetjs/runtime/slot")));
const url = (code: string) => "data:text/javascript;base64," + Buffer.from(code).toString("base64");
const iconUrl = url(server(compile(iconSource, { target: "server", filename: "icon.tsx" }).code));
async function render(source: string): Promise<string> {
  const result = compile(source, { target: "server", filename: "page.tsx" });
  assert.deepEqual(result.diagnostics, []);
  const lucideUrl = import.meta.resolve("lucide");
  const module = (await import(url(server(result.code).replaceAll(KIT, JSON.stringify(iconUrl)).replaceAll('"lucide"', JSON.stringify(lucideUrl))))) as {
    Page(): unknown;
  };
  return renderToString(() => module.Page() as never) as Promise<string>;
}
const page = (imports: string[], body: string) =>
  `import { Icon } from ${KIT};\nimport { ${imports.join(", ")} } from "lucide";\nexport function Page() {\n  return <div>${body}</div>;\n}\n`;

test("every lucide icon × constant prop sets: inline svg, same server bytes as the component", async () => {
  const names = Object.keys(lucide).filter((name) => /^[A-Z]/.test(name) && Array.isArray((lucide as Record<string, unknown>)[name]));
  assert.ok(names.length > 1000);
  const sets = [
    "",
    ' size={16} class="size-4"',
    ' class="a" size="1.5em" color="red" strokeWidth={1.5}',
    " size={12} strokeWidth={1} absoluteStrokeWidth",
    ' data-slot="icon" class="b" absoluteStrokeWidth={false}',
  ];
  for (const props of sets) {
    const source = page(names, names.map((name) => `<Icon icon={${name}}${props} />`).join("\n"));
    const rewritten = staticIcons(source, "page.tsx", load);
    assert.doesNotMatch(rewritten.slice(rewritten.indexOf("export function")), /<Icon /, props);
    assert.equal(rewritten.split("\n").length, source.split("\n").length);
    assert.equal(await render(rewritten), await render(source), props);
  }
});

test("only constant simple props on an imported lucide binding are rewritten", async () => {
  const cases: [string, boolean][] = [
    ['<Icon icon={Check} size={16} class="x" />', true],
    ['<Icon icon={Check} title="Done" />', false], // accessible name: component
    ['<Icon icon={Check} aria-label="Done" />', false],
    ["<Icon icon={Check} size={n} />", false], // not a constant
    ["<Icon icon={Check} {...rest} />", false],
    ['<Icon icon={Check} style={{ color: "red" }} />', false],
    ['<Icon icon={Check} class="a&amp;b" />', false], // entity: JSX decoding is the compiler's
    ["<Icon icon={Other} />", false], // not a lucide import
    ["<Icon icon={Check}></Icon>", true],
  ];
  for (const [element, rewritten] of cases) {
    const source = `import { Icon } from ${KIT};\nimport { Check } from "lucide";\nconst Other = Check, n = 3, rest = {};\nexport const A = () => ${element};\n`;
    const out = staticIcons(source, "a.tsx", load);
    assert.equal(!out.includes("<Icon "), rewritten, element);
  }
  // Shadowed names, type-only imports, aliases, strings and comments.
  const shadow = `import { Icon } from ${KIT};\nimport { Check } from "lucide";\nexport const A = (Check: never) => <Icon icon={Check} />;\n`;
  assert.equal(staticIcons(shadow, "a.tsx", load), shadow);
  const typeOnly = `import type { Icon } from ${KIT};\nimport { Check } from "lucide";\nexport const A = () => <Icon icon={Check} />;\n`;
  assert.equal(staticIcons(typeOnly, "a.tsx", load), typeOnly);
  const alias = `import { Icon as I } from ${KIT};\nimport { Check as Ok } from "lucide";\nexport const A = () => <I icon={Ok} />;\n`;
  assert.match(staticIcons(alias, "a.tsx", load), /<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="24" .*><path d="M20 6 9 17l-5-5" \/><\/svg>/);
  const text = `import { Icon } from ${KIT};\nimport { Check } from "lucide";\nexport const code = "<Icon icon={Check} />"; // <Icon icon={Check} />\nexport const A = () => <p>{"<Icon icon={Check} />"}</p>;\n`;
  assert.equal(staticIcons(text, "a.tsx", load), text);
  // No lucide module resolvable: unchanged.
  const plain = `import { Icon } from ${KIT};\nimport { Check } from "lucide";\nexport const A = () => <Icon icon={Check} />;\n`;
  assert.equal(
    staticIcons(plain, "a.tsx", () => null),
    plain,
  );
});

test("inline icons compile to one static template: no component call, no resume state", async () => {
  const source = staticIcons(page(["Check"], '<Icon icon={Check} size={16} class="ok" />'), "page.tsx", load);
  const dom = compile(source, { target: "dom", filename: "page.tsx" });
  assert.deepEqual(dom.diagnostics, []);
  assert.doesNotMatch(dom.code, /__rivet_c\(Icon|_svgShapes/);
  assert.match(dom.code, /_tpl\("<div><svg xmlns=http:\/\/www.w3.org\/2000\/svg width=16 height=16 /);
  const resumed = compile(source, { target: "server", filename: "page.tsx", resume: { module: "src/page.tsx" } });
  assert.deepEqual(resumed.diagnostics, []);
  assert.deepEqual(resumed.symbols ?? [], []);
});

test("Vite plugin: both targets inline icons (lucide from the importer's resolution); `staticIcons: false` keeps the call", async () => {
  const { rivet } = await import("../vite.ts");
  type Transform = (this: unknown, code: string, id: string, options?: { ssr?: boolean }) => { code: string } | null;
  const root = new URL("..", import.meta.url).pathname;
  const plugin = (options = {}) => {
    const p = rivet(options);
    (p.configResolved as (config: unknown) => void)({ root, command: "build", build: {}, plugins: [] });
    return (ssr: boolean) =>
      (p.transform as Transform).call({ error: (e: { message: string }) => assert.fail(e.message) }, source, root + "src/page.tsx", { ssr })!.code;
  };
  const source = page(["Check"], '<Icon icon={Check} size={16} class="ok" />');
  for (const ssr of [false, true]) {
    assert.doesNotMatch(plugin()(ssr), /Icon,|_svgShapes/);
    assert.match(plugin()(ssr), /M20 6 9 17l-5-5/);
    assert.match(plugin({ staticIcons: false })(ssr), /Icon/);
    assert.doesNotMatch(plugin({ staticIcons: false })(ssr), /M20 6 9 17l-5-5/);
  }
});
