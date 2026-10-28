import { test } from "vitest";
import assert from "node:assert/strict";
import { brotliCompressSync, constants } from "node:zlib";
import { assertFrameCeilings, measureFrame, metTargets, overTargets, tailRecords, targetGaps } from "../size-report/frame-metrics.mjs";

const bytes = (text: string) => Buffer.from(text);
const br = (b: Buffer) => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;

test("frame payload counts script, runtime, fetch-ahead, modulepreload and tail chunk URLs once", () => {
  const html =
    `<link rel="modulepreload" href="/shared.js"><script src='/boot.js'></script>` +
    `<script type="rivet/boundaries" data-rt="/boot.js" data-fo="/boot.js /shared.js /shared.js">{"v":1,"b":[[1,0,0,"a#A"]],"m":{"a#A":"/a.js"}}</script>`;
  const result = measureFrame(
    html,
    new Map([
      ["/boot.js", bytes("123")],
      ["/shared.js", bytes("45678")],
      ["/a.js", bytes("9")],
    ]),
  );
  assert.deepEqual(result.urls, ["/a.js", "/boot.js", "/shared.js"]);
  assert.equal(result.files, 3);
  assert.equal(result.jsRaw, 9);
  assert.equal(result.records, 1);
});

test("frame payload reads tail v2: runs expand, short URLs resolve against data-ab", () => {
  const tail = {
    v: 2,
    n: [["a#A", 0]],
    u: ["page-x"],
    b: [
      [1, 0, 0, 0, [1, 2]],
      [
        2,
        0,
        0,
        -1,
        3,
        [
          [1, 0, 0],
          [-1, 0, 0],
        ],
      ],
    ],
  };
  assert.equal(tailRecords(tail), 7);
  const html = `<script type="rivet/boundaries" data-ab="/assets/" data-rt="/assets/rt.js" data-fo="page-x /other/y.js">${JSON.stringify(tail)}</script>`;
  const result = measureFrame(
    html,
    new Map([
      ["/assets/rt.js", bytes("rt")],
      ["/assets/page-x.js", bytes("px")],
      ["/other/y.js", bytes("y")],
    ]),
  );
  assert.deepEqual(result.urls, ["/assets/page-x.js", "/assets/rt.js", "/other/y.js"]);
  assert.equal(result.records, 7);
});

test("frame payload fails on a missing referenced asset", () => {
  assert.throws(() => measureFrame('<script type="rivet/boundaries" data-fo="/missing.js">{"b":[]}</script>', new Map()), /missing.*\/missing\.js/i);
});

test("frame payload separates inline JavaScript from state, counts hole markers", () => {
  const boundaries = '{"v":1,"b":[[1],[2]]}';
  const html = `<p><!--[-->x<!--]--></p><script>é()</script><script type="module">go()</script><script type="rivet/boundaries">${boundaries}</script><script type="application/json">{}</script>`;
  const result = measureFrame(html, new Map());
  assert.equal(result.inlineJsBytes, 8);
  assert.equal(result.stateBytes, Buffer.byteLength(boundaries) + 2);
  assert.equal(result.records, 2);
  assert.equal(result.holes, 1);
});

test("frame payload compresses each unique external file separately", () => {
  const file = bytes("A".repeat(1000));
  const result = measureFrame(
    '<script data-fo="/a.js /b.js /a.js"></script>',
    new Map([
      ["/a.js", file],
      ["/b.js", file],
    ]),
  );
  assert.equal(result.jsRaw, 2000);
  assert.equal(result.jsBr, 2 * br(file));
});

test("frame ceilings: reductions pass (and are reported), one byte of growth fails, counts are exact under tolerance", () => {
  const ceiling = measureFrame('<script data-fo="/a.js"></script>', new Map([["/a.js", bytes("12345")]]));
  assert.deepEqual(assertFrameCeilings({ card: { ...ceiling, jsRaw: 4 } }, { card: ceiling }), ["card: jsRaw 5 -> 4"]);
  assert.throws(() => assertFrameCeilings({ card: { ...ceiling, jsRaw: 6 } }, { card: ceiling }), /card.*jsRaw.*6.*5/);
  assert.doesNotThrow(() => assertFrameCeilings({ card: { ...ceiling, jsRaw: 6 } }, { card: ceiling }, { tolerance: 1 }));
  assert.throws(() => assertFrameCeilings({ card: { ...ceiling, files: 2 } }, { card: ceiling }, { tolerance: 100 }), /files/);
});

test("frame ceilings reject html / state / inline / holes growth and missing frames", () => {
  const ceiling = measureFrame("", new Map());
  for (const field of ["html", "holes", "records", "stateBytes", "inlineJsBytes", "jsBr"] as const)
    assert.throws(() => assertFrameCeilings({ card: { ...ceiling, [field]: ceiling[field] + 1 } }, { card: ceiling }), new RegExp(field));
  assert.throws(() => assertFrameCeilings({}, { card: ceiling }), /card.*missing/i);
  assert.throws(() => assertFrameCeilings({ card: ceiling }, {}), /card.*missing/i);
});

test("overTargets lists every frame over its target", () => {
  assert.deepEqual(overTargets({ a: { jsGz: 10 }, b: { jsGz: 0 } }, { a: { jsGz: 0 }, b: { jsGz: 0 }, c: { jsGz: 0 } }), ["a: jsGz 10 > target 0"]);
});

test("ZERO targets met in the baseline gate; unmet ones stay informational", () => {
  const targets = { met: { jsGz: 0 }, near: { jsGz: 5120 }, open: { jsGz: 0 }, unmeasured: { jsGz: 0 } };
  const baseline = { met: { jsGz: 0 }, near: { jsGz: 2949 }, open: { jsGz: 32718 } };
  assert.deepEqual(metTargets(baseline, targets), { met: { jsGz: 0 }, near: { jsGz: 5120 } });
  // Within the met targets (growth under the target passes), the open one over its target: informational.
  assert.deepEqual(targetGaps({ met: { jsGz: 0 }, near: { jsGz: 5000 }, open: { jsGz: 30000 } }, targets, baseline), {
    met: { met: { jsGz: 0 }, near: { jsGz: 5120 } },
    gating: [],
    open: ["open: jsGz 30000 > target 0"],
  });
  // A met target regressing gates.
  const { gating, open } = targetGaps({ met: { jsGz: 1 }, near: { jsGz: 5121 }, open: { jsGz: 32718 } }, targets, baseline);
  assert.deepEqual(gating, ["met: jsGz 1 > target 0", "near: jsGz 5121 > target 5120"]);
  assert.deepEqual(open, ["open: jsGz 32718 > target 0"]);
});
