// Co-load chunk groups (`build/coload.ts`): which shared chunks a two-pass build merges, and the plugin's group config.
import { afterAll, beforeAll, test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COLOAD_ENV, coloadPlugin, pageScripts, planCoload, type ColoadPlan } from "../build/coload.ts";

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "rivet-coload-"));
});
afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

const chunk = (modules: string[], imports: string[] = [], entry = false, size = 100) => ({ modules, entry, imports, size });

test("pageScripts: script src, modulepreload and data-fo (short data-ab entries)", () => {
  const html =
    `<script type="module" src="/assets/app-AAAAAAAA.js"></script><link rel="modulepreload" href="/assets/rt-BBBBBBBB.js">` +
    `<script type="rivet/boundaries" data-ab="/assets/" data-fo="a-CCCCCCCC /assets/b-DDDDDDDD.js">{}</script>`;
  assert.deepEqual(pageScripts(html), ["/assets/app-AAAAAAAA.js", "/assets/rt-BBBBBBBB.js", "/assets/a-CCCCCCCC.js", "/assets/b-DDDDDDDD.js"]);
});

test("planCoload: shared chunks with the same page sets merge; entries, lone chunks and cycles stay apart", async () => {
  const work = join(dir, "plan");
  const client = join(work, "client");
  await mkdir(join(client, "p2"), { recursive: true });
  const chunks = {
    "assets/e1-AAAAAAAA.js": chunk(["src/e1.tsx"], ["assets/big-AAAAAAAA.js", "assets/small-AAAAAAAA.js"], true),
    "assets/e2-AAAAAAAA.js": chunk(["src/e2.tsx"], ["assets/big-AAAAAAAA.js", "assets/small-AAAAAAAA.js", "assets/lone-AAAAAAAA.js"], true),
    "assets/big-AAAAAAAA.js": chunk(["src/big.ts", "src/big2.ts"], [], false, 900),
    "assets/small-AAAAAAAA.js": chunk(["src/small.ts"], [], false, 50),
    "assets/lone-AAAAAAAA.js": chunk(["src/lone.ts"]),
    // x and y are always fetched together, but x → mid → y and mid is fetched on more pages: merging x and y would
    // make a chunk cycle through mid
    "assets/x-AAAAAAAA.js": chunk(["src/x.ts"], ["assets/mid-AAAAAAAA.js"]),
    "assets/mid-AAAAAAAA.js": chunk(["src/mid.ts"], ["assets/y-AAAAAAAA.js"]),
    "assets/y-AAAAAAAA.js": chunk(["src/y.ts"]),
  };
  await writeFile(join(work, "chunks.json"), JSON.stringify({ v: 1, chunks }));
  const page = (files: string[]) => files.map((f) => `<link rel="modulepreload" href="/${f}">`).join("");
  await writeFile(
    join(client, "index.html"),
    page([
      "assets/e1-AAAAAAAA.js",
      "assets/big-AAAAAAAA.js",
      "assets/small-AAAAAAAA.js",
      "assets/x-AAAAAAAA.js",
      "assets/mid-AAAAAAAA.js",
      "assets/y-AAAAAAAA.js",
    ]),
  );
  await writeFile(
    join(client, "p2/index.html"),
    page(["assets/e2-AAAAAAAA.js", "assets/big-AAAAAAAA.js", "assets/small-AAAAAAAA.js", "assets/lone-AAAAAAAA.js", "assets/mid-AAAAAAAA.js"]),
  );
  const report = await planCoload({ dir: work, client });
  const plan = JSON.parse(await readFile(join(work, "plan.json"), "utf8")) as ColoadPlan;
  // big + small + mid: both pages fetch them (big names the group: the largest member); x + y: mid sits between them
  assert.equal(plan.groups[0]!.name, "big");
  assert.deepEqual(plan.groups[0]!.modules, ["src/big.ts", "src/big2.ts", "src/mid.ts", "src/small.ts"]);
  assert.ok(plan.groups.every((g) => !g.modules.includes("src/e1.tsx") && !g.modules.includes("src/lone.ts")));
  assert.ok(!plan.groups.some((g) => g.modules.includes("src/x.ts") && g.modules.includes("src/y.ts")), "no group across a chunk cycle");
  assert.equal(report.pages, 2);
});

test("planCoload: a chunk some page reaches lazily (dynamic import) stays apart from one it never reaches", async () => {
  const work = join(dir, "lazy");
  const client = join(work, "client");
  await mkdir(join(client, "b"), { recursive: true });
  const chunks = {
    "assets/e-AAAAAAAA.js": chunk(["src/e.tsx"], ["assets/s1-AAAAAAAA.js", "assets/s2-AAAAAAAA.js"], true),
    "assets/f-AAAAAAAA.js": chunk(["src/f.tsx"], ["assets/lazy-AAAAAAAA.js"], true),
    "assets/lazy-AAAAAAAA.js": chunk(["src/lazy.tsx"], ["assets/s1-AAAAAAAA.js"], true),
    "assets/s1-AAAAAAAA.js": chunk(["src/s1.ts"]),
    "assets/s2-AAAAAAAA.js": chunk(["src/s2.ts"]),
  };
  await writeFile(join(work, "chunks.json"), JSON.stringify({ v: 1, chunks }));
  await writeFile(
    join(client, "index.html"),
    `<script type="module" src="/assets/e-AAAAAAAA.js"></script><link rel="modulepreload" href="/assets/s1-AAAAAAAA.js"><link rel="modulepreload" href="/assets/s2-AAAAAAAA.js">`,
  );
  await writeFile(join(client, "b/index.html"), `<script type="module" src="/assets/f-AAAAAAAA.js"></script>`);
  await planCoload({ dir: work, client });
  const plan = JSON.parse(await readFile(join(work, "plan.json"), "utf8")) as ColoadPlan;
  assert.deepEqual(plan.groups, [], "s1 is reachable on page b (after input), s2 is not");
});

test("planCoload: two groups that would import each other (a chunk cycle between groups) are not both merged", async () => {
  const work = join(dir, "pair");
  const client = join(work, "client");
  await mkdir(join(client, "b"), { recursive: true });
  // a1 + a2: both pages; b1 + b2: page one only. a1 → b1 and b2 → a2: each group alone has no cycle, both merged do.
  const chunks = {
    "assets/e-AAAAAAAA.js": chunk(["src/e.tsx"], ["assets/a1-AAAAAAAA.js", "assets/a2-AAAAAAAA.js", "assets/b1-AAAAAAAA.js", "assets/b2-AAAAAAAA.js"], true),
    // f reaches b2 lazily (a dynamic import): page b reaches b1 + b2 without fetching them before input.
    "assets/f-AAAAAAAA.js": chunk(["src/f.tsx"], ["assets/a1-AAAAAAAA.js", "assets/a2-AAAAAAAA.js", "assets/b2-AAAAAAAA.js"], true),
    "assets/a1-AAAAAAAA.js": chunk(["src/a1.ts"], ["assets/b1-AAAAAAAA.js"]),
    "assets/a2-AAAAAAAA.js": chunk(["src/a2.ts"]),
    "assets/b1-AAAAAAAA.js": chunk(["src/b1.ts"]),
    "assets/b2-AAAAAAAA.js": chunk(["src/b2.ts"], ["assets/a2-AAAAAAAA.js"]),
  };
  await writeFile(join(work, "chunks.json"), JSON.stringify({ v: 1, chunks }));
  const page = (files: string[]) => files.map((f) => `<link rel="modulepreload" href="/${f}">`).join("");
  await writeFile(join(client, "index.html"), page(Object.keys(chunks).filter((f) => !f.includes("/f-"))));
  await writeFile(join(client, "b/index.html"), page(["assets/f-AAAAAAAA.js", "assets/a1-AAAAAAAA.js", "assets/a2-AAAAAAAA.js"]));
  await planCoload({ dir: work, client });
  const plan = JSON.parse(await readFile(join(work, "plan.json"), "utf8")) as ColoadPlan;
  const merged = (a: string, b: string) => plan.groups.some((g) => g.modules.includes(a) && g.modules.includes(b));
  assert.ok(merged("src/a1.ts", "src/a2.ts") || merged("src/b1.ts", "src/b2.ts"), "one of them merges");
  assert.ok(!(merged("src/a1.ts", "src/a2.ts") && merged("src/b1.ts", "src/b2.ts")), JSON.stringify(plan.groups));
});

test("coloadPlugin: inert without the env; with a plan, one group capturing the planned modules only", async () => {
  const before = process.env[COLOAD_ENV];
  try {
    delete process.env[COLOAD_ENV];
    const inert = coloadPlugin();
    assert.equal(inert.config, undefined);
    assert.equal(inert.generateBundle, undefined);
    const work = join(dir, "plugin");
    await mkdir(work, { recursive: true });
    await writeFile(join(work, "plan.json"), JSON.stringify({ v: 1, groups: [{ name: "g", modules: ["src/a.ts", "\0virtual"] }] }));
    process.env[COLOAD_ENV] = work;
    const plugin = coloadPlugin();
    const config = (plugin.config as (c: { root: string }) => any)({ root: "/app" });
    const group = config.environments.client.build.rolldownOptions.output.codeSplitting.groups[0];
    assert.equal(group.includeDependenciesRecursively, false);
    assert.equal(group.name("/app/src/a.ts"), "g");
    assert.equal(group.name("\0virtual"), "g");
    assert.equal(group.name("/app/src/b.ts"), null);
    assert.equal(group.test("/app/src/b.ts"), false);
  } finally {
    if (before === undefined) delete process.env[COLOAD_ENV];
    else process.env[COLOAD_ENV] = before;
  }
});
