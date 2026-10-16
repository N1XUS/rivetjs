// Pure helpers of the resume fuzz (`../fuzz`): tolerance triples, structural diffs, rerun commands, pin matching and the
// in-page id normaliser (run in happy-dom). The Chromium suites (`cdk-resume-fuzz` / `ui-resume-fuzz`) rely on these.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { applyRules, rerunCommand, selectRoutes, structuralDiff, type FuzzFinding, type FuzzRouteResult, type Rule } from "../fuzz/resume-fuzz.ts";
import { installFuzz, type FuzzPage } from "../fuzz/page.ts";
import { checkPin, openFindings, pinMatches, type FuzzPin } from "../fuzz/suite.ts";

const finding = (diff: string, step = 4, route = "/r"): FuzzFinding => ({
  route,
  kind: "mismatch",
  step,
  steps: [],
  repro: [],
  elements: {},
  detail: "context\n" + diff,
  diff,
});
const result = (findings: FuzzFinding[]): FuzzRouteResult => ({ route: "/r", elements: 1, steps: 6, findings }) as FuzzRouteResult;

test("applyRules drops an exact (attribute, resumed, csr) triple only while both lines carry it", () => {
  const rules = new Map<number, Rule[]>([[1, [["data-hovered", 'data-hovered="true"', null]]]]);
  const keys = [0, 1];
  const r = { lines: ["/r", '<div data-hovered="true" id="a">'], keys };
  const c = { lines: ["/r", '<div id="a">'], keys };
  assert.deepEqual(applyRules(rules, r, c), [
    ["/r", '<div id="a">'],
    ["/r", '<div id="a">'],
  ]);
  // Another value of the same attribute is compared again.
  const later = { lines: ["/r", '<div data-hovered="false" id="a">'], keys };
  assert.deepEqual(applyRules(rules, later, c)[0], later.lines);
  // A different element key (or none) is never tolerated.
  assert.deepEqual(applyRules(rules, { ...r, keys: [0, 2] }, { ...c, keys: [0, 2] })[0], r.lines);
});

test("structuralDiff reports the first differing line of each page only", () => {
  assert.equal(structuralDiff(["/r", "<main>", '  "a"', '  "b"'], ["/r", "<main>", '  "x"', '  "b"']), 'resumed: "a"\ncsr: "x"');
  assert.equal(structuralDiff(["/r", "<p>"], ["/r"]), "resumed: <p>\ncsr: (end)");
});

test("rerunCommand selects exactly the route and keeps the plan", () => {
  const command = rerunCommand("/visual/select.v2", "ui-resume-fuzz", { RIVET_FUZZ_SEED: "7" });
  assert.equal(command, "RIVET_FUZZ_ROUTES='/^\\/visual\\/select\\.v2$/' RIVET_FUZZ_SEED=7 npx vitest run --project ui-resume-fuzz --maxWorkers=1");
  const pattern = /RIVET_FUZZ_ROUTES='([^']+)'/.exec(command)![1]!;
  assert.deepEqual(selectRoutes(["/visual/select.v2", "/visual/selectxv2", "/visual/select.v2-x"], { RIVET_FUZZ_ROUTES: pattern }), ["/visual/select.v2"]);
});

test("a pin matches the finding's diff (not its context) and its step", () => {
  const pin: FuzzPin = { route: "/r", kind: "mismatch", match: 'resumed only [data-x="1"]', step: 5, owner: "cdk", note: "n" };
  assert.ok(pinMatches(pin, finding('line 2 <div>: resumed only [data-x="1"] / csr only []')));
  assert.ok(!pinMatches(pin, finding('line 2 <div>: resumed only [data-x="1"] / csr only []', 6)));
  assert.ok(!pinMatches({ ...pin, match: "context" }, finding("other")));
});

test("a pin whose match no longer hits fails loudly", () => {
  const open: FuzzPin = { route: "/r", kind: "mismatch", match: "data-gone", owner: "cdk", note: "n" };
  const now = result([finding('line 2 <div>: resumed only [data-new="1"] / csr only []')]);
  // Open pin: its `test.fails` body no longer throws, so the `test.fails` (and the suite) fails.
  assert.doesNotThrow(() => checkPin(open, now));
  assert.throws(() => checkPin({ ...open, match: "data-new" }, now), /still found/);
  // Design pin (and the open one): the finding it no longer matches stays open, so the route's test fails.
  assert.equal(openFindings(now.findings, [{ ...open, design: true }]).length, 1);
  assert.equal(openFindings(now.findings, [{ ...open, match: "data-new", design: true }]).length, 0);
});

test("generated ids are numbered in attribute-name order: the order attributes were set in does not matter", () => {
  const snap = (build: (doc: Document) => void): string[] => {
    const window = new Window({ url: "http://localhost/r" });
    const doc = window.document as unknown as Document;
    build(doc);
    // `installFuzz` is sent as source to the page by Playwright: evaluate it the same way, against this window.
    new Function("window", "with (window) { (" + installFuzz.toString() + ")(); }")(window);
    const lines = (window as unknown as { __rivetFuzz: FuzzPage }).__rivetFuzz.snapshot().lines;
    void window.happyDOM.close();
    return lines;
  };
  // Server: label id first, then the group's `aria-labelledby` / `aria-describedby`; client (other id scheme): the
  // group's references are set before the target ids exist and in the opposite order.
  const server = snap((doc) => {
    doc.body.innerHTML = '<div role="group" aria-describedby="rv4" aria-labelledby="rv3"><span id="rv3">L</span><span id="rv4">D</span></div>';
  });
  const client = snap((doc) => {
    const group = doc.createElement("div");
    group.setAttribute("aria-labelledby", "rvc0");
    group.setAttribute("role", "group");
    group.setAttribute("aria-describedby", "rvc1");
    for (const [id, text] of [
      ["rvc0", "L"],
      ["rvc1", "D"],
    ] as const) {
      const span = doc.createElement("span");
      span.id = id;
      span.textContent = text;
      group.append(span);
    }
    doc.body.append(group);
  });
  assert.deepEqual(client, server);
  assert.equal(server[1], '<div aria-describedby="#0" aria-labelledby="#1" role="group">');
  // Deterministic: the same DOM always gives the same numbers.
  assert.deepEqual(
    snap((doc) => {
      doc.body.innerHTML = '<div role="group" aria-describedby="rv4" aria-labelledby="rv3"><span id="rv3">L</span><span id="rv4">D</span></div>';
    }),
    server,
  );
});
