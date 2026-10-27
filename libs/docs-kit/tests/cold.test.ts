// Cold first-interaction matrix (`tools/cold.ts`): cell lists, shards, skip rules, known-red patterns, the report,
// and the storage init scripts + touch steps in Chromium. Run: `npx vitest run --project docs-kit libs/docs-kit/tests/cold.test.ts`.
import { strict as assert } from "node:assert";
import { afterAll, beforeAll, test } from "vitest";
import { chromium, devices, type Browser } from "playwright";
import { cellMatches, cellName, cells, coldReport, coldSpan, knownRed, parseList, shard, skipReason, storageInit, type Cell } from "../tools/cold.ts";
import { run } from "../tools/example-checks.ts";
import { STORAGES } from "../tools/cold.ts";

const cell = (engine: Cell["engine"], input: Cell["input"], storage: Cell["storage"] = "normal", timing: Cell["timing"] = "early"): Cell => ({
  engine,
  input,
  storage,
  timing,
});

test("cells are engine-major products", () => {
  const list = cells(["chromium", "webkit"], ["mouse", "touch"], ["normal"], ["early"]);
  assert.deepEqual(list.map(cellName), [
    "chromium/mouse/normal/early",
    "chromium/touch/normal/early",
    "webkit/mouse/normal/early",
    "webkit/touch/normal/early",
  ]);
});

test("parseList rejects unknown values and falls back", () => {
  assert.deepEqual(parseList(undefined, STORAGES, ["normal"], "storage"), ["normal"]);
  assert.deepEqual(parseList("throws,denied", STORAGES, ["normal"], "storage"), ["throws", "denied"]);
  assert.throws(() => parseList("private", STORAGES, ["normal"], "storage"), /unknown storage "private"/);
});

test("shards partition the list", () => {
  const list = Array.from({ length: 10 }, (_, i) => i);
  const parts = [shard(list, "1/3"), shard(list, "2/3"), shard(list, "3/3")];
  assert.deepEqual(
    parts.flat().sort((a, b) => a - b),
    list,
  );
  assert.deepEqual(parts[0], [0, 3, 6, 9]);
  assert.deepEqual(shard(list, undefined), list);
  assert.throws(() => shard(list, "0/3"), /bad shard/);
  assert.throws(() => shard(list, "4/3"), /bad shard/);
});

test("skip rules: touch needs a finger-able first input; WebKit mouse cannot tap", () => {
  assert.equal(skipReason([{ click: "b" }], cell("webkit", "touch")), null);
  assert.match(skipReason([{ hover: "b" }, { click: "b" }], cell("chromium", "touch"))!, /hover has no touch form/);
  assert.match(skipReason([{ expect: ["p", "x"] }], cell("chromium", "mouse"))!, /no input step/);
  assert.equal(skipReason([{ tap: "b" }], cell("chromium", "mouse")), null);
  assert.match(skipReason([{ tap: "b" }], cell("webkit", "mouse"))!, /touch context/);
  assert.match(skipReason([{ click: "b" }, { wheel: ["b", 10] }], cell("webkit", "touch"))!, /mouse wheel/);
  assert.equal(skipReason([{ click: "b" }, { wheel: ["b", 10] }], cell("chromium", "touch")), null);
});

test("coldSpan covers the first input and its assertions", () => {
  assert.equal(coldSpan([{ expect: ["p", "a"] }, { click: "b" }, { expect: ["p", "b"] }, { click: "c" }, { expect: ["p", "c"] }]), 2);
  assert.equal(coldSpan([{ click: "b" }, { expect: ["p", "b"] }]), 1);
  assert.equal(coldSpan([{ expect: ["p", "b"] }]), -1);
});

test("known-red cell patterns", () => {
  assert.ok(cellMatches(undefined, cell("webkit", "touch")));
  assert.ok(cellMatches("webkit", cell("webkit", "touch", "throws")));
  assert.ok(cellMatches("webkit/touch", cell("webkit", "touch", "throws")));
  assert.ok(cellMatches("*/*/throws|denied", cell("chromium", "mouse", "denied")));
  assert.ok(!cellMatches("webkit/mouse", cell("webkit", "touch")));
  const reds = [{ id: "a", cells: "webkit/touch", reason: "r" }];
  assert.equal(knownRed(reds, "a", cell("webkit", "touch"))?.reason, "r");
  assert.equal(knownRed(reds, "a", cell("chromium", "touch")), undefined);
  assert.equal(knownRed(reds, "b", cell("webkit", "touch")), undefined);
});

test("report lists counts per cell and every non-pass result", () => {
  const md = coldReport(
    [
      { id: "a", cell: "chromium/mouse/normal/early", verdict: "pass" },
      { id: "b", cell: "chromium/mouse/normal/early", verdict: "red", detail: "x | y", cold: true },
      { id: "c", cell: "chromium/mouse/normal/early", verdict: "skip", detail: "no input step" },
    ],
    "T",
  );
  assert.match(md, /\| chromium\/mouse\/normal\/early \| 1 \| 1 \| 0 \| 0 \| 0 \| 1 \| 0 \|/);
  assert.match(md, /\| b \| chromium\/mouse\/normal\/early \| red \| yes \| x \\\| y \|/);
  assert.doesNotMatch(md, /\| c \|/);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  await browser.close();
});

const PROBE = `(() => {
  const out = [];
  for (const f of [() => localStorage.setItem("a", "1"), () => { sessionStorage.b = "1"; }, () => localStorage.getItem("a")])
    try { out.push(String(f())); } catch (e) { out.push(e.name); }
  return out;
})()`;

async function probe(storage: Cell["storage"]): Promise<string[]> {
  const context = await browser.newContext();
  try {
    await context.addInitScript(storageInit, storage);
    const page = await context.newPage();
    await page.route("http://cold.test/", (route) => route.fulfill({ body: "<p>x</p>", contentType: "text/html" }));
    await page.goto("http://cold.test/");
    return await page.evaluate(PROBE);
  } finally {
    await context.close();
  }
}

test("storage init scripts: normal, throws (writes), denied (reads)", async () => {
  assert.deepEqual(await probe("normal"), ["undefined", "undefined", "1"]);
  assert.deepEqual(await probe("throws"), ["QuotaExceededError", "QuotaExceededError", "null"]);
  assert.deepEqual(await probe("denied"), ["SecurityError", "SecurityError", "SecurityError"]);
});

test("touch: click steps tap (touch pointer events) in a phone context", async () => {
  const context = await browser.newContext({ ...devices["iPhone 15"] });
  try {
    const page = await context.newPage();
    await page.setContent(
      `<meta name="viewport" content="width=device-width"><button id="b">b</button><p id="log"></p>
      <script>const b = document.getElementById("b"); b.addEventListener("pointerdown", (e) => (document.getElementById("log").textContent += e.pointerType + " "));
      b.addEventListener("click", () => (document.getElementById("log").textContent += "click"));</script>`,
    );
    await run(page, { click: "#b" }, "cold-test", { touch: true });
    await run(page, { expect: ["#log", "touch click"] }, "cold-test");
  } finally {
    await context.close();
  }
});
