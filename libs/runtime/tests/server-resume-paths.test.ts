// Path-addressed rows (`server-resume-paths.ts` `rowPaths`): element paths of a compiled row template, null whenever
// the HTML parser could restructure the row (the browser would walk a different tree than the server wrote).
import { test } from "vitest";
import assert from "node:assert/strict";
import { rowPaths } from "../server-resume-paths.ts";

const R = ["data-r"];

test("rowPaths: tags and element child indexes below the row root; content slots listed", () => {
  const fragments = ["<li", "", "", '><a class="open"', "", "", ">", '</a><button class="pick"', "", ">pick</button></li>"];
  const entries = [["class"], ["data-id"], R, ["href"], null, R, null, null, R];
  assert.deepEqual(rowPaths(fragments, entries, [2, 5, 8]), { paths: ["li:", "a:0", "button:1"], content: [6] });
  // Text, comments and void elements: only elements count, a void element takes its index.
  assert.deepEqual(rowPaths(["<div>x<!-- c --><br><i", ">", "</i></div>"], [R, null], [0]), { paths: ["i:1"], content: [1] });
  // A table row root and its cells; plain SVG shapes (self-closed) inside a cell.
  assert.deepEqual(rowPaths(["<tr><td", '><svg><path d="M0>1"/></svg></td><td><button', ">b</button></td></tr>"], [R, R], [0, 1]), {
    paths: ["td:0", "button:1.0"],
    content: [],
  });
});

test("rowPaths: templates the parser restructures get no paths", () => {
  const none = (fragments: string[], entries: unknown[], ids: number[]) => assert.equal(rowPaths(fragments, entries, ids), null, fragments.join("|"));
  none(["<p><div", ">x</div></p>"], [R], [0]); // <div> closes the <p>
  none(["<div><div/>", "<b", "></b></div>"], [null, R], [1]); // `/>` ignored on an HTML element
  none(["<a><a", "></a></a>"], [R], [0]); // nested links
  none(["<button><button", "></button></button>"], [R], [0]);
  none(["<ul><li><li", "></li></li></ul>"], [R], [0]); // implied </li>
  none(["<h1><h2", "></h2></h1>"], [R], [0]);
  none(["<div><tr", "></tr></div>"], [R], [0]); // fostered / dropped
  none(["<table><tr", "></tr></table>"], [R], [0]);
  none(["<div><textarea", "></textarea></div>"], [R], [0]); // RCDATA
  none(["<div><select", "></select></div>"], [R], [0]);
  none(["<svg><foreignObject", "></foreignObject></svg>"], [R], [0]); // camelCase SVG
  none(["<svg><div", "></div></svg>"], [R], [0]); // HTML breakout
  none(["<li", "></li><li></li>"], [R], [0]); // two roots
  none(["<div", ">", "</div>"], [R, ["class"]], [0]); // an attribute slot outside a tag
  none(["<div>", "<b", "></b></div>"], [R, R], [1]); // an id slot outside a tag
});
