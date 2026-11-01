// Static glyphs with live classes: compare native DOM behavior against the original Icon component.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Check } from "lucide";
import { compile } from "../index.ts";
import { staticIcons } from "../static-icons.ts";
import { withPage, rewrite } from "../../runtime/tests/resume/harness.ts";
import type { Served } from "../../runtime/tests/resume/harness.ts";
import type { ClassValue } from "../../runtime/style.ts";

const source = `import type { ClassValue } from "@rivetjs/runtime/style";
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Check } from "lucide";
const value = signal<ClassValue>("first");
let reads = 0;
const classes = () => (reads++, value());
export const setClass = (next: ClassValue) => value.set(next);
export const classReads = () => reads;
export function Page() {
  return <main><Icon icon={Check} size={16} class={classes()} aria-hidden="true" data-slot="glyph" /></main>;
}`;
const dom = (text: string, filename: string) => {
  const result = compile(text, { target: "dom", filename });
  assert.deepEqual(result.diagnostics, []);
  return rewrite(result.code).replaceAll('"@rivetjs/kit/icon"', '"/icon.mjs"').replaceAll('"lucide"', '"/glyph.mjs"');
};

test("live SVG classes keep namespace, element identity and reader behavior", async () => {
  const icon = await readFile(new URL("../../kit/icon.tsx", import.meta.url), "utf8");
  const after = staticIcons(source, "page.tsx", () => ({ Check }));
  assert.doesNotMatch(after.slice(after.indexOf("export function")), /<Icon /);
  const files: Record<string, Served> = {
    "/icon.mjs": dom(icon, "icon.tsx"),
    "/glyph.mjs": "export const Check = " + JSON.stringify(Check) + ";",
    "/before.mjs": dom(source, "page.tsx"),
    "/after.mjs": dom(after, "page.tsx"),
  };
  for (const name of ["before", "after"])
    files["/" + name] = `<!doctype html><html><body><div id="app"></div><script type="module">
      import { mount } from "/dom.ts"; import { Page, setClass, classReads } from "/${name}.mjs";
      window.setClass = setClass; window.classReads = classReads;
      mount(() => Page(), document.getElementById("app"));
    </script></body></html>`;
  await withPage(files, async (page) => {
    const snapshots: unknown[][] = [];
    for (const name of ["before", "after"]) {
      const errors: string[] = [];
      const onError = (error: Error) => errors.push(error.message);
      page.on("pageerror", onError);
      await page.goto("http://rivet.test/" + name);
      await page.waitForFunction(() => document.querySelector("svg") && (window as unknown as { classReads(): number }).classReads);
      const svg = await page.locator("svg").elementHandle();
      assert.ok(svg);
      const shape = await page.locator("svg path").elementHandle();
      assert.ok(shape);
      const values: unknown[] = [];
      for (const value of ["first", "next", null, undefined, 0, 17, 42n, false, true, ["array", "tokens"], { selected: true, absent: false }, "last two"]) {
        await page.evaluate((next) => (window as unknown as { setClass(v: ClassValue): void }).setClass(next), value);
        assert.equal(await svg.evaluate((node) => node === document.querySelector("svg")), true, "updates retain the SVG element");
        assert.equal(await shape.evaluate((node) => node === document.querySelector("svg path")), true, "class updates retain the glyph shape");
        values.push(
          await page.evaluate(() => ({
            // Comment anchors and attribute insertion order are internal template details.
            elements: [...document.querySelectorAll("svg, svg *")].map((node) => ({
              tag: node.localName,
              text: node.textContent,
              attributes: node
                .getAttributeNames()
                .sort()
                .map((key) => [key, node.getAttribute(key)]),
            })),
            namespaces: [...document.querySelectorAll("svg, svg *")].map((node) => node.namespaceURI),
            reads: (window as unknown as { classReads(): number }).classReads(),
          })),
        );
      }
      assert.deepEqual(errors, []);
      page.off("pageerror", onError);
      snapshots.push(values);
    }
    assert.deepEqual(snapshots[1], snapshots[0], "inlining preserves live class updates and evaluation counts");
  });
});
