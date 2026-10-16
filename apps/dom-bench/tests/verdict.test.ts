import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { asStat, browserDrift, overall, publishedChrome, stat, verdict } from "../verdict.ts";
import { startServer } from "../server.ts";

test("ties and noise are not wins: the review's examples are TIEs", () => {
  // 0.30 vs 0.30, 78.3 vs 79.0 (0.9%), 1.04 vs 1.05 (1%) — all strict-compare WINs before B4.
  assert.equal(verdict({ median: 0.3 }, { median: 0.3 }, "lower"), "TIE");
  assert.equal(verdict({ median: 78.3 }, { median: 79.0 }, "lower"), "TIE");
  assert.equal(verdict({ median: 1.04 }, { median: 1.05 }, "lower"), "TIE");
});

test("a >=3% gap wins or loses only when trial ranges do not overlap", () => {
  assert.equal(verdict({ median: 90 }, { median: 100 }, "lower"), "WIN", "no ranges: margin decides");
  assert.equal(verdict({ median: 110 }, { median: 100 }, "lower"), "LOSE");
  assert.equal(verdict({ median: 90, min: 85, max: 101 }, { median: 100, min: 98, max: 103 }, "lower"), "TIE", "overlap");
  assert.equal(verdict({ median: 90, min: 85, max: 95 }, { median: 100, min: 98, max: 103 }, "lower"), "WIN");
  assert.equal(verdict({ median: 1200, min: 1150, max: 1250 }, { median: 1000, min: 990, max: 1010 }, "higher"), "WIN");
  assert.equal(verdict({ median: 900, min: 880, max: 920 }, { median: 1000, min: 990, max: 1010 }, "higher"), "LOSE");
  assert.equal(verdict({ median: 0 }, { median: 0 }, "lower"), "TIE");
});

test("stat, overall and browser drift", () => {
  assert.deepEqual(stat([3, 1, 2, 10]), { median: 2.5, min: 1, max: 10, n: 4 });
  assert.equal(stat([]), null);
  assert.deepEqual(asStat(5), { median: 5 });
  assert.equal(overall(["WIN", "WIN"]), "WIN");
  assert.equal(overall(["WIN", "TIE"]), "TIE");
  assert.equal(overall(["TIE", "LOSE", "WIN"]), "LOSE");
  assert.equal(overall([]), "n/a");
  assert.equal(browserDrift("154.0.8037.97", "154.0.8037.98"), "patch");
  assert.equal(browserDrift("153.0.8010.12", "154.0.8037.98"), "major");
  assert.equal(browserDrift(undefined, "1"), "unknown");
});

test("krausest reference browser is read from published.json source.chrome (was always unknown)", () => {
  const published = JSON.parse(readFileSync(new URL("../krausest/published.json", import.meta.url), "utf8"));
  assert.match(publishedChrome(published) ?? "", /^\d+\.\d+\.\d+\.\d+$/);
  assert.equal(publishedChrome({ chrome: "1.2.3.4" }), "1.2.3.4");
});

test("dom-bench fixture server cross-origin-isolates pages (fine performance.now)", async () => {
  const server = await startServer();
  try {
    const response = await fetch(`${server.url}/rivet`);
    assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
    assert.equal(response.headers.get("cross-origin-embedder-policy"), "require-corp");
  } finally {
    await server.close();
  }
});
