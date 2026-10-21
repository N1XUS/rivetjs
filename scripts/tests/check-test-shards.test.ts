// scripts/ci/check-test-shards.ts: the CI test matrix covers every nx `test` target exactly once.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { checkShards, SHARDS_FILE, type Shard, type TestTargets } from "../ci/check-test-shards.ts";
import { balance, invocations } from "../vitest-seq.ts";

const targets: TestTargets = {
  a: "vitest run --project a",
  b: "vitest run --project b; vitest run --project b-browser",
  c: "vitest run --project c --project c-dev",
  d: 'node scripts/vitest-seq.ts "--project d" "--project d-components"',
};

test("a complete matrix passes, with a project split into vitest file shards", () => {
  const shards: Shard[] = [
    { name: "ab", projects: ["a", "b"] },
    { name: "d 1/2", projects: ["d"], args: "--shard=1/2" },
    { name: "d 2/2", projects: ["d"], args: "--shard=2/2" },
    { name: "c 1/2", projects: ["c"], args: "--shard=1/2" },
    { name: "c 2/2", projects: ["c"], args: "--shard=2/2" },
  ];
  assert.deepEqual(checkShards(shards, targets), []);
});

test("missing, duplicated and unknown projects are reported", () => {
  const errors = checkShards(
    [
      { name: "one", projects: ["a", "x"] },
      { name: "two", projects: ["a"] },
      { name: "two", projects: [] },
    ],
    targets,
  );
  assert.deepEqual(errors, [
    'shard "one": "x" has no nx test target',
    '"a" is in shards "one" and "two"',
    'duplicate shard name "two"',
    'shard "two" lists no projects',
    '"b" (nx test target) is in no shard',
    '"c" (nx test target) is in no shard',
    '"d" (nx test target) is in no shard',
  ]);
});

test("split shards: complete parts, one project, a single vitest command, --shard only", () => {
  const errors = checkShards(
    [
      { name: "ad", projects: ["a", "d"] },
      { name: "b 1/2", projects: ["b"], args: "--shard=1/2" },
      { name: "b 2/2", projects: ["b"], args: "--shard=2/2" },
      { name: "c 1/3", projects: ["c"], args: "--shard=1/3" },
      { name: "c 3/3", projects: ["c"], args: "--shard=3/3" },
      { name: "ac", projects: ["a", "c"], args: "--shard=2/3" },
      { name: "bail", projects: ["a"], args: "--bail=1" },
    ],
    targets,
  );
  assert.deepEqual(errors, [
    'shard "ac": a split shard (args) holds exactly one project',
    'shard "bail": args must be --shard=i/n, got "--bail=1"',
    '"b" is split but its test target is not one `vitest run` / `scripts/vitest-seq.ts` command: vitest run --project b; vitest run --project b-browser',
    '"c" split /3 has parts 1, 3',
  ]);
});

test("a project both split and in a plain shard is reported", () => {
  const errors = checkShards(
    [
      { name: "all", projects: ["a", "b", "c", "d"] },
      { name: "c 1/2", projects: ["c"], args: "--shard=1/2" },
      { name: "c 2/2", projects: ["c"], args: "--shard=2/2" },
    ],
    targets,
  );
  assert.deepEqual(errors, ['"c" is split but also in shard "all"']);
});

test("the checked-in matrix is well formed (coverage against nx: `node scripts/ci/check-test-shards.ts`, gates job)", () => {
  const shards: Shard[] = JSON.parse(readFileSync(new URL(`../../${SHARDS_FILE}`, import.meta.url), "utf8")).shards;
  const listed = Object.fromEntries(shards.flatMap((s) => s.projects).map((p) => [p, "vitest run --project " + p]));
  assert.deepEqual(checkShards(shards, listed), []);
  assert.ok(readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8").includes(SHARDS_FILE));
});

test("vitest-seq: one run per --project group, other appended args go to every run, --shard is its own", () => {
  assert.deepEqual(invocations(["--project ui --maxWorkers=2", "--project ui-components", "--shard=2/3", "--bail=1"]), {
    groups: [
      ["--project", "ui", "--maxWorkers=2", "--bail=1"],
      ["--project", "ui-components", "--bail=1"],
    ],
    shard: { index: 2, count: 3 },
  });
  assert.equal(invocations(["--project a"]).shard, undefined);
  assert.throws(() => invocations(["--shard=1/2"]), /no "--project …" group/);
  assert.throws(() => invocations(["--project a", "--shard=3/2"]), /invalid --shard=3\/2/);
});

test("vitest-seq: balance spreads measured-heavy files over the shards, every file exactly once", () => {
  const files = [
    ["u/a.test.ts", "u/b.test.ts", "u/c.test.ts", "u/b.test.ts"],
    ["c/visual.test.ts", "c/a11y.test.ts", "c/x.test.ts", "c/y.test.ts"],
  ];
  const weights = { seconds: { "c/visual.test.ts": 300, "c/a11y.test.ts": 200, "u/a.test.ts": 40 }, defaults: { "c/": 5, "u/": 1 } };
  const shards = balance(files, 3, weights);
  assert.deepEqual(shards, [
    [[], ["c/visual.test.ts"]],
    [[], ["c/a11y.test.ts"]],
    [
      ["u/a.test.ts", "u/b.test.ts", "u/c.test.ts"],
      ["c/x.test.ts", "c/y.test.ts"],
    ],
  ]);
  const all = shards.flatMap((s) => s.flat()).sort();
  assert.deepEqual(all, [...new Set(files.flat())].sort());
  assert.deepEqual(balance(files, 1, weights), [files.map((l) => [...new Set(l)].sort())]);
});
