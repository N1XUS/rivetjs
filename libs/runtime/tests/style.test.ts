// G10: class / style normalization and the CSS value rule shared by every target.
import { test } from "vitest";
import assert from "node:assert/strict";
import { _class, _style, _styleProp, _styleValue, _spreadClass, unsafeStyle } from "../style.ts";
import { cx } from "../css.ts";
import { execFileSync } from "node:child_process";

test("_class flattens strings, arrays and objects; toggles add once and remove every occurrence", () => {
  assert.equal(_class("a b"), "a b");
  assert.equal(_class(["a", false, null, 0, "", ["b", { c: 1, d: 0, "e f": true }]]), "a b c e f");
  assert.equal(_class({ x: true, y: undefined }), "x");
  assert.equal(_class(null), null);
  assert.equal(_class(""), null);
  assert.equal(_class("a b", { b: false, c: true }), "a c");
  assert.equal(_class("a  a", { a: false }), null);
  assert.equal(_class("a", { a: true }), "a");
  assert.equal(_class(undefined, { x: 1, y: "" }), "x");
  // Whitespace at the ends / runs inside, removals compacting in place, a removal after an add.
  assert.equal(_class(" \ta  b\n", { b: false, c: true }), "a c");
  assert.equal(_class("a b a c", { a: false, d: true, c: false }), "b d");
  assert.equal(_class("a", { b: true, b2: true, a: false }), "b b2");
  assert.equal(_class(" ", { a: false }), null);
  assert.equal(_class(["x", { y: 1 }], { "y z": 1, x: 0 }), "y y z");
});

test("cx keeps its string behaviour and accepts class values", () => {
  assert.equal(cx("card", false, "active", undefined, ""), "card active");
  assert.equal(cx(), "");
  assert.equal(cx("a", ["b", { c: true, d: false }]), "a b c");
});

test("style properties: custom properties as written, camelCase to kebab-case, anything else throws", () => {
  assert.equal(_styleProp("--rv-x"), "--rv-x");
  assert.equal(_styleProp("backgroundColor"), "background-color");
  assert.equal(_styleProp("WebkitTransition"), "-webkit-transition");
  assert.equal(_styleProp("margin-top"), "margin-top");
  for (const bad of ["", "--", "a;b", "color:red", "1x", "a b", "--a;b", "x}"]) assert.throws(() => _styleProp(bad), /Unsafe style property/, bad);
});

test("unsafe style values: url / src / image-set / expression / javascript: and declaration breakers", () => {
  for (const bad of [
    "url(a.png)",
    "URL( a.png )",
    "u r l(x)",
    "image-set('a.png' 1x)",
    "-webkit-image-set(a 1x)",
    "src(x)",
    "expression(alert(1))",
    "javascript:alert(1)",
    "red; background: blue",
    "red}",
    "{",
    "\\75 rl(x)",
    "red /* x",
  ])
    assert.equal(unsafeStyle(bad), true, bad);
  for (const ok of ["red", "1px solid #000", "calc(100% - 2px)", "var(--x, 0)", "rgb(0 0 0 / 50%)", '"a"', "translate(1px, 2px)"])
    assert.equal(unsafeStyle(ok), false, ok);
});

test("style values: skipped values, numbers as is, unsafe strings dropped", () => {
  assert.equal(_styleValue("color", null), null);
  assert.equal(_styleValue("color", undefined), null);
  assert.equal(_styleValue("color", false), null);
  assert.equal(_styleValue("color", true), null);
  assert.equal(_styleValue("color", ""), null);
  assert.equal(_styleValue("opacity", 0), "0");
  assert.equal(_styleValue("--x", 1.5), "1.5");
  assert.equal(_styleValue("color", "red"), "red");
  assert.equal(_styleValue("background", "url(x)"), null);
});

test("_style joins style objects in order (later properties win), refuses strings", () => {
  assert.equal(_style({ color: "red", "--x": 1 }, { backgroundColor: "blue", color: null }), "--x:1;background-color:blue");
  assert.equal(_style({ color: "red" }, { color: "blue" }), "color:blue");
  assert.equal(_style(null, undefined, false, {}), null);
  assert.equal(_style({ background: "url(x)", color: "red" }), "color:red");
  assert.throws(() => _style("color:red"), /Unsupported style value/);
  assert.throws(() => _style({ "a;b": 1 }), /Unsafe style property/);
});

test("_spreadClass applies toggles to the spread class (or className / accessor)", () => {
  assert.deepEqual(_spreadClass({ id: "a", class: "x y" }, { y: false, z: true }), { id: "a", class: "x z" });
  assert.deepEqual(_spreadClass({ className: "x" }, { z: 1 }), { class: "x z" });
  assert.deepEqual(_spreadClass({ class: () => "w" }, { z: 0 }), { class: "w" });
  assert.deepEqual(_spreadClass(null, { z: 0 }), { class: null });
});

// A fresh process per resolution (warnings are once per property and value).
const warnings = (conditions: string[]): string[] =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        ...conditions,
        "--input-type=module",
        "-e",
        `import { _style, _styleValue } from ${JSON.stringify(new URL("../style.ts", import.meta.url).href)};
         const warnings = [];
         console.warn = (...args) => warnings.push(args.join(" "));
         _style({ background: "url(x)" }, { background: "url(x)", color: "red" });
         _styleValue("--x", "expression(1)");
         process.stdout.write(JSON.stringify(warnings));`,
      ],
      { encoding: "utf8" },
    ),
  );

test("unsafe style values (production): dropped silently", () => {
  assert.deepEqual(warnings([]), []);
});

test("unsafe style values (development): one warning per property and value", () => {
  const list = warnings(["--conditions=development"]);
  assert.equal(list.length, 2, list.join("\n"));
  assert.match(list[0]!, /unsafe style value for background dropped \("url\(x\)"\)/);
  assert.match(list[1]!, /unsafe style value for --x dropped/);
});

// STYLE-FAST: the as-written ASCII regex must decide exactly like the reference rule (lowercase, strip
// whitespace / controls, regex) — seeded fuzz over keyword fragments, separators, case and non-ASCII fallbacks.
test("unsafeStyle's ASCII fast path agrees with the reference rule (seeded fuzz)", () => {
  const reference = (value: string) =>
    /[\\;{}]|\/\*|(?:url|src|image-set|expression)\(|javascript:/.test(value.toLowerCase().replace(/[\s\u0000-\u001f]+/g, ""));
  const parts = ["url", "URL", "u", "r", "l", "src", "s", "rc", "image", "-set", "image-set", "expr", "ession", "expression", "java", "script", "javascript"];
  parts.push(
    "(",
    ")",
    ":",
    "/",
    "*",
    "/*",
    "\\",
    ";",
    "{",
    "}",
    " ",
    "\t",
    "\n",
    "\u0000",
    "\u001f",
    "\u007f",
    "!",
    "\u000b",
    "a",
    "Z",
    "-",
    "0",
    "12px",
    "var(--x)",
  );
  parts.push("calc(", "rgb(", " ", " ", "K", "İ", "é", "﻿", "jav ascript:", "ur\u000bl(");
  let seed = 7;
  const next = () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 8) / (1 << 24);
  let unsafe = 0;
  for (let n = 0; n < 20000; n++) {
    let value = "";
    for (let k = 1 + Math.floor(next() * 6); k > 0; k--) value += parts[Math.floor(next() * parts.length)];
    const want = reference(value);
    unsafe += +want;
    assert.equal(unsafeStyle(value), want, JSON.stringify(value));
  }
  assert.ok(unsafe > 1000 && unsafe < 19000, "both outcomes covered: " + unsafe);
  for (const value of ["U R L (x)", "j a v a s c r i p t :", "/ *", "image - set(", "url\u0000(", "e\nx\tp\rression(", "Url(", "SRC(", "ImAgE-SeT("])
    assert.equal(unsafeStyle(value), reference(value), JSON.stringify(value));
  for (const value of ["12px", "calc(var(--rv-h) * 3 + 12px)", "translate(3px, 4px)", "rgb(1, 2, 3)", "100%", "0", "-webkit-box", "a:b"])
    assert.equal(unsafeStyle(value), reference(value), value);
});
