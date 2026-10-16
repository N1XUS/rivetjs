// Round 2: C1 (numeric literals on boolean attributes, DOM fold), C4 (static `popover`, missing
// boolean attributes), C14 (static `defaultValue` / `defaultChecked`, JSX entity decoding).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const targets = [{ target: "server" }, { target: "dom" }] as const;
const out = (source: string, options: (typeof targets)[number]) => {
  const result = compile(`export const A = () => ${source};`, options);
  assert.deepEqual(result.diagnostics, []);
  return result.code;
};

test("C1: DOM folds `hidden={0}` to no attribute and `hidden={1}` to the bare attribute (server: runtime truthiness)", () => {
  const dom = { target: "dom" } as const;
  const zero = out("<div hidden={0} disabled={00}><i/></div>", dom);
  assert.doesNotMatch(zero, /hidden|disabled/);
  const one = out("<div hidden={1}><i/></div>", dom);
  assert.match(one, /_tpl\("<div hidden><i>/);
  // The server evaluates the number at runtime (truthiness), as before.
  assert.match(out("<div hidden={0}><i/></div>", { target: "server" }), /__rivetAttribute\("hidden", 0\)/);
  // Non-boolean attributes keep folding numbers as text.
  assert.match(out("<div tabIndex={0}><i/></div>", dom), /tabindex=0/);
});

test("C4: static `popover` is the empty keyword; media / shadow-root / color-input booleans are bare", () => {
  for (const options of targets) {
    const code = out(
      '<div popover><video disablepictureinpicture disableremoteplayback /><template shadowrootdelegatesfocus shadowrootclonable shadowrootserializable /><input type="color" alpha /></div>',
      options,
    );
    assert.doesNotMatch(code, /="true"|=true/, JSON.stringify(options));
    for (const name of ["popover", "disablepictureinpicture", "disableremoteplayback", "shadowrootdelegatesfocus", "alpha"])
      assert.match(code, new RegExp(` ${name}[ >\\\\"]`));
  }
  // An explicit keyword stays.
  assert.match(out('<div popover="manual" />', { target: "server" }), /popover=\\?"manual/);
});

test("C14: static defaultValue / defaultChecked write the content attributes", () => {
  for (const options of targets) {
    const code = out('<form><input defaultValue="a&amp;b" /><input type="checkbox" defaultChecked /></form>', options);
    assert.doesNotMatch(code, /default(value|checked)/i, JSON.stringify(options));
    assert.match(code, /value=\\?"?a&amp;b/);
    assert.match(code, / checked/);
  }
});

test("C14: entities decode like JSX (only `;`-terminated references)", () => {
  const code = out('<p title="&copy &copy; &#65 &#66;">&notanentity; &not &amp; &notin; &#x41;</p>', { target: "server" });
  assert.match(code, /&amp;notanentity; &amp;not &amp; ∉ A</);
  assert.match(code, /title=\\"&amp;copy © &amp;#65 B\\"/);
});
