// C12: v2 templates drop the closing tags that end them and the quotes around safe attribute values;
// the HTML parser must still build exactly the tree the full markup describes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { compile } from "../index.ts";

const templates = (source: string): string[] => {
  const r = compile(source, { target: "dom", filename: "m.tsx" });
  assert.deepEqual(r.diagnostics, []);
  return [...r.code.matchAll(/__rivet_tpl\(("(?:[^"\\]|\\.)*")/g)].map((m) => JSON.parse(m[1]!) as string);
};
const window = new Window();
const parse = (html: string) => {
  const t = window.document.createElement("template");
  t.innerHTML = html;
  return t.innerHTML;
};

const cases: [source: string, compact: string, full: string][] = [
  [
    `export const A = () => <div class="a b" id="x"><input type="text" name="q" /><a href="/">h</a><img src="a.png" /><br /><p data-x="v">t</p></div>;`,
    `<div class="a b" id=x><input type=text name=q><a href="/">h</a><img src=a.png><br><p data-x=v>t`,
    `<div class="a b" id="x"><input type="text" name="q"><a href="/">h</a><img src="a.png"><br><p data-x="v">t</p></div>`,
  ],
  [
    `export const A = () => <table><tbody><tr><td title="t">x</td></tr></tbody></table>;`,
    `<table><tbody><tr><td title=t>x`,
    `<table><tbody><tr><td title="t">x</td></tr></tbody></table>`,
  ],
  [`export const A = () => <ul><li><b>x</b></li><li><i>y</i></li></ul>;`, `<ul><li><b>x</b></li><li><i>y`, `<ul><li><b>x</b></li><li><i>y</i></li></ul>`],
  // Values the parser would read differently stay quoted; raw text keeps its own end tag.
  [
    `export const A = () => <p title="a=b" lang="x'y" dir="" data-a="&amp;" data-b="1&gt;0">t</p>;`,
    `<p title="a=b" lang="x&#39;y" dir="" data-a="&amp;" data-b="1&gt;0">t`,
    `<p title="a=b" lang="x'y" dir="" data-a="&amp;" data-b="1&gt;0">t</p>`,
  ],
  [`export const A = () => <div><textarea name="t">hi</textarea></div>;`, `<div><textarea name=t>hi</textarea>`, `<div><textarea name="t">hi</textarea></div>`],
];

test("v2 templates omit trailing end tags and safe attribute quotes, parsing to the same tree", () => {
  for (const [source, compact, full] of cases) {
    const [html] = templates(source);
    assert.equal(html, compact, source);
    assert.equal(parse(html!), parse(full), source);
  }
});
