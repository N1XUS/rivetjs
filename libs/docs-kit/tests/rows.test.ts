// `tools/rows.ts`: the per-For share of a page's `rivet/state` (check-examples `rows:` column, lazy collection rows T1).
import { strict as assert } from "node:assert";
import { brotliCompressSync } from "node:zlib";
import { test } from "vitest";
import { componentFacts, moduleFile, pageRows, rowFacts, rowsColumn, scanMarkers } from "../tools/rows.ts";

const page = (body: string, state: object) =>
  `<!doctype html><html><body>${body}<script type="rivet/state" data-region="0">${JSON.stringify(state)}</script></body></html>`;
const br = (text: string) => brotliCompressSync(Buffer.from(text)).length;

test("scanMarkers pairs markers like dom-resume: ids left out continue the stride, ends close the innermost", () => {
  const { parent } = scanMarkers('<div data-r="1"><!--r2[--><!--r5[--><b data-r="6"></b><!--]--><!--r[--><!--r9--><!--/--><!--]--><!--]--></div>');
  assert.deepEqual(
    [...parent],
    [
      [1, -1],
      [2, -1],
      [5, 2],
      [6, 5],
      [8, 2],
      [9, 8],
    ],
  );
  assert.deepEqual(
    [...scanMarkers("<!--r2[--><!--r5[--><!--]--><!--r[--><!--r9--><!--/--><!--]--><!--]-->").regions],
    [
      [-1, 1],
      [2, 2],
    ],
  );
  // Raw text elements hold no markers.
  assert.equal(scanMarkers("<textarea><!--r3--></textarea><script>'<!--r4[-->'</script>").parent.size, 0);
});

// Two rows of one For in a region: row-private captures (`t` 5, 6) are the For's share; the items (3, 4, reached from the
// region entry's row list) and the shared signal (0) are not.
const state = {
  v: 1,
  h: null,
  rt: null,
  c: ["/a.js"],
  s: [0, "m.tsx#List$a", "$h"],
  t: [{ s: 1 }, 0, [3, 4], { p: ["name", "a"] }, { p: ["name", "b"] }, "row-a", "row-b"],
  e: { "2": { click: [1, [0, 3, 5], [0]] }, "4": { click: [1, [0, 4, 6], [0]] } },
  m: {},
  b: [[10, "#", 0, [2], [0], [0], -1, null, [1, 3, 0, 3, 4, 0]]],
  fx: [],
  ce: [],
};
const html = page('<ul data-r="0"><!--r10[--><!--r1[--><li data-r="2">a</li><!--]--><!--r3[--><li data-r="4">b</li><!--]--><!--]--></ul>', state);

test("pageRows: a For's rows, records and exclusively reached table entries", () => {
  const rows = pageRows(html, { saved: true })!;
  const text = JSON.stringify(state);
  assert.deepEqual(rows.state, { raw: text.length, brotli: br(text) });
  assert.deepEqual(pageRows(html)!.state, { raw: text.length });
  assert.equal(rows.fors.length, 1);
  const [list] = rows.fors;
  const share = [
    `"2":${JSON.stringify(state.e["2"])}`,
    `"4":${JSON.stringify(state.e["4"])}`,
    JSON.stringify([state.b[0]![8], 0, null]),
    '"row-a"',
    '"row-b"',
  ].join(",");
  const without = JSON.stringify({
    ...state,
    e: {},
    b: [[10, "#", 0, [2], [0], [0], -1, null, 0]],
    t: [{ s: 1 }, 0, [3, 4], { p: ["name", "a"] }, { p: ["name", "b"] }, 0, 0],
  });
  assert.deepEqual(list, {
    symbol: "m.tsx#List$a",
    mode: "recorded",
    fors: 1,
    rows: 2,
    depth: 0,
    entries: { e: 2, b: 0, t: 2 },
    raw: share.length,
    brotli: br(share),
    saved: br(text) - br(without),
  });
  assert.equal(rowsColumn(rows), `rows: recorded m.tsx#List$a ×2 ${Math.round(share.length / 2)} B / ${Math.round(br(share) / 2)} B br per row`);
  // Compiler facts (T2 `forRows`, per group symbol): the reason a group stays recorded, or `eligible`.
  const facts = (map: Record<string, { lazy: boolean; reason?: string }>) => (symbol: string) => map[symbol.replace(/\$[^#$]*$/, "")];
  assert.match(
    rowsColumn(pageRows(html, { facts: facts({ "m.tsx#List": { lazy: false, reason: "portal" } }) })),
    /^rows: recorded \(portal\) m\.tsx#List\$a ×2 /,
  );
  assert.equal(pageRows(html, { facts: facts({ "m.tsx#List": { lazy: true } }) })!.fors[0]!.reason, "eligible");
  assert.equal(pageRows(html, { facts: facts({}) })!.fors[0]!.reason, undefined);
});

test("pageRows: a nested For is its own group; its region entry is the outer row's", () => {
  // Outer rows r1 / r5 each hold an inner For (region r3 / r7) with one row (r4 / r8) whose element has a handler.
  const nested = {
    ...state,
    s: [0, "m.tsx#Outer$a", "$i"],
    t: [{ s: 1 }, 0, [3, 4], { p: ["name", "a"] }, { p: ["name", "b"] }, "cell-a", "cell-b"],
    e: { "9": { click: [1, [0, 5], [0]] }, "11": { click: [1, [0, 6], [0]] } },
    b: [
      [10, "#", 0, [2], [0], [0], -1, null, [1, 3, 0, 5, 4, 0]],
      [3, "#", 1, [3], [0], [0], 1, null, [4, 3, 0]],
      [7, "#", 1, [4], [0], [0], 5, null, [8, 4, 0]],
    ],
  };
  const doc = page(
    '<table><!--r10[--><!--r1[--><tr><!--r3[--><!--r4[--><td data-r="9">a</td><!--]--><!--]--></tr><!--]--><!--r5[--><tr><!--r7[--><!--r8[--><td data-r="11">b</td><!--]--><!--]--></tr><!--]--><!--]--></table>',
    nested,
  );
  const rows = pageRows(doc)!;
  assert.deepEqual(
    rows.fors.map((f) => [f.symbol, f.depth, f.fors, f.rows, f.entries]),
    [
      ["m.tsx#Outer$a", 0, 1, 2, { e: 0, b: 2, t: 0 }],
      ["m.tsx#Outer$i", 1, 2, 2, { e: 2, b: 0, t: 2 }],
    ],
  );
  assert.match(rowsColumn(rows), /^rows: recorded m\.tsx#Outer\$a ×2 .*; \+ recorded m\.tsx#Outer\$i ×2 in 2 lists /);
});

test("pageRows: lazy rows (swap harness markers) report `lazy`; pages without Fors / state", () => {
  const lazy = {
    ...state,
    t: [],
    e: {},
    b: [[7, "#", 0, [], [], [0], -1, "interaction"]],
  };
  const rows = pageRows(page("<ul><!--r7[--><!--L--><!--l--><li>a</li><!--l--><li>b</li><!--l--><li>c</li><!--]--></ul>", lazy))!;
  assert.deepEqual(
    rows.fors.map((f) => [f.symbol, f.mode, f.fors, f.rows, f.raw]),
    [["m.tsx#List$a", "lazy", 1, 3, 0]],
  );
  // T4's lazy row record (state `L`): lazy, symbol = its region's, rows = markers forId + 1 + k, share = the entry.
  const entry = [8, 7, 1, 2, "", 0, [0]];
  const record = { ...lazy, b: [[7, "#", 0, [], [], [0], -1]], L: [entry] };
  const recorded = pageRows(page("<ul><!--r7[--><!--r9[--><li>a</li><!--]--><!--r10[--><li>b</li><!--]--><!--]--></ul>", record))!;
  assert.deepEqual(
    recorded.fors.map((f) => [f.symbol, f.mode, f.rows, f.raw]),
    [["m.tsx#List$a", "lazy", 2, JSON.stringify(entry).length]],
  );
  assert.equal(rowsColumn(pageRows(page("<p></p>", { ...state, b: [], e: {}, t: [] }))), "rows: -");
  assert.equal(pageRows("<p>static</p>"), null);
  assert.equal(rowsColumn(null), "rows: -");
});

test("compiler facts: per component (row symbol, else the declaration above the For), reasons joined; real compile", async () => {
  const source = ["export function List() {", "  return <For />;", "}", "const Grid = () => {", "  <For />;", "  <For />;", "};", ""].join("\n");
  const facts = componentFacts("m.tsx", source, [
    { line: 2, lazy: true, symbol: "m.tsx#List$x1" },
    { line: 5, lazy: false, reason: "capture" },
    { line: 6, lazy: false, reason: "portal" },
  ]);
  assert.deepEqual(
    [...facts],
    [
      ["m.tsx#List", { lazy: true }],
      ["m.tsx#Grid", { lazy: false, reason: "capture/portal" }],
    ],
  );
  assert.match(moduleFile("/app", "@rivetjs/cdk/table/index.tsx"), /libs\/cdk\/table\/index\.tsx$/);
  assert.equal(moduleFile("/app", "src/routes/index.tsx"), "/app/src/routes/index.tsx");
  // The compiler's verdicts over a real module (cdk Table header rows: lazy-eligible); unknown modules: none.
  const lookup = await rowFacts("/app");
  assert.deepEqual(lookup("@rivetjs/cdk/table/index.tsx#TableHeaderRow$0ha"), { lazy: true });
  assert.equal(lookup("src/missing.tsx#List$a"), undefined);
  assert.equal(lookup("no-hash"), undefined);
});
