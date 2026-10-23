import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { routeTable, scanRoutes } from "../build/routes.ts";

const patterns = (files: string[]) => routeTable(files).routes.map((r) => r.pattern);

test("file names map to router patterns", () => {
  const table = routeTable(["index.tsx", "about.tsx", "blog/index.tsx", "blog/[slug].tsx", "docs/[...path].tsx", "(marketing)/pricing.tsx"]);
  const byId = Object.fromEntries(table.routes.map((r) => [r.id, r.pattern]));
  assert.deepEqual(byId, {
    index: "/",
    about: "/about",
    "blog/index": "/blog",
    "blog/[slug]": "/blog/:slug",
    "docs/[...path]": "/docs/*path",
    "(marketing)/pricing": "/pricing",
  });
  assert.deepEqual(table.routes.find((r) => r.id === "blog/[slug]")?.params, ["slug"]);
});

test("static segments win over params, params over splats, deterministic order", () => {
  assert.deepEqual(patterns(["[...all].tsx", "[id].tsx", "new.tsx", "index.tsx", "a/[b].tsx", "a/b.tsx"]), ["/a/b", "/a/:b", "/new", "/:id", "/", "/*all"]);
  assert.deepEqual(patterns(["docs/[...p].tsx", "docs/index.tsx"]), ["/docs", "/docs/*p"]);
});

test("optional params expand longest first", () => {
  const table = routeTable(["[[lang]]/about.tsx"]);
  assert.deepEqual(
    table.routes.map((r) => [r.id, r.pattern, r.params]),
    [
      ["[[lang]]/about", "/about", []],
      ["[[lang]]/about", "/:lang/about", ["lang"]],
    ],
  );
});

test("layouts nest outer to inner; nearest 404/error win; server siblings attach", () => {
  const table = routeTable([
    "_layout.tsx",
    "_layout.server.ts",
    "_404.tsx",
    "_error.tsx",
    "admin/_layout.server.ts",
    "admin/_error.tsx",
    "admin/users/[id].tsx",
    "admin/users/[id].server.ts",
    "api/health.server.ts",
  ]);
  const user = table.routes.find((r) => r.id === "admin/users/[id]");
  assert.deepEqual(user?.layouts, [{ page: "_layout.tsx", server: "_layout.server.ts" }, { server: "admin/_layout.server.ts" }]);
  assert.equal(user?.server, "admin/users/[id].server.ts");
  assert.equal(user?.error, "admin/_error.tsx");
  assert.equal(user?.notFound, "_404.tsx");
  assert.equal(table.notFound, "_404.tsx");
  assert.equal(table.error, "_error.tsx");
  const health = table.routes.find((r) => r.id === "api/health");
  assert.equal(health?.page, undefined);
  assert.equal(health?.server, "api/health.server.ts");
});

test("ignored files and folders", () => {
  assert.deepEqual(patterns(["a.test.tsx", "b.spec.tsx", "types.d.ts", "_private/x.tsx", "_helper.tsx", ".hidden/x.tsx", "util.ts", "ok.tsx"]), ["/ok"]);
});

test("conflicts and invalid names are errors naming the files", () => {
  assert.throws(() => routeTable(["[a].tsx", "[b].tsx"]), /Route conflict: \[a\] and \[b\] both match \/:/);
  assert.throws(() => routeTable(["about.tsx", "(g)/about.tsx"]), /Route conflict/);
  assert.throws(() => routeTable(["[...a]/b.tsx"]), /must be the last segment/);
  assert.throws(() => routeTable(["[a]/[a].tsx"]), /duplicate parameter/);
  assert.throws(() => routeTable(["a:b.tsx"]), /Invalid route segment/);
  assert.throws(() => routeTable(["_404.server.ts"]), /only _layout may have a server module/);
});

test("patterns round-trip through the runtime matcher", async () => {
  const { compileRoutes } = await import("@rivetjs/runtime/router");
  const table = routeTable(["index.tsx", "blog/[slug].tsx", "docs/[...path].tsx", "[[lang]]/about.tsx", "café.tsx"]);
  const match = compileRoutes(table.routes.map((r) => ({ path: r.pattern, render: () => r.id })));
  const at = (path: string) => {
    const m = match(new URL(path, "http://x"));
    return m && [m.route.render(undefined, m), { ...m.params }];
  };
  assert.deepEqual(at("/blog/hello%20world"), ["blog/[slug]", { slug: "hello world" }]);
  assert.deepEqual(at("/docs/a/b"), ["docs/[...path]", { path: "a/b" }]);
  assert.deepEqual(at("/de/about"), ["[[lang]]/about", { lang: "de" }]);
  assert.deepEqual(at("/about"), ["[[lang]]/about", {}]);
  assert.deepEqual(at("/caf%C3%A9"), ["café", {}]);
  assert.equal(at("/nope/x/y"), null);
});

test("scanRoutes reads a directory tree", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-routes-"));
  try {
    await mkdir(join(dir, "blog"), { recursive: true });
    await writeFile(join(dir, "index.tsx"), "");
    await writeFile(join(dir, "blog", "[slug].tsx"), "");
    await writeFile(join(dir, "blog", "[slug].server.ts"), "");
    const table = await scanRoutes(dir);
    assert.deepEqual(
      table.routes.map((r) => [r.pattern, r.page, r.server]),
      [
        ["/blog/:slug", "blog/[slug].tsx", "blog/[slug].server.ts"],
        ["/", "index.tsx", undefined],
      ],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
