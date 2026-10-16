import { test } from "vitest";
import assert from "node:assert/strict";
// An import failure leaves `api` empty; each test then fails on its typeof assertion.
const api = (await import("../router.ts").catch(() => ({}))) as typeof import("../router.ts");
const url = (path: string): URL => new URL(path, "https://routes.test");
test("route matching covers roots, static, params, terminal splats, and one trailing slash", () => {
  assert.equal(typeof api.compileRoutes, "function");
  const matcher = api.compileRoutes([
    { path: "/", render: () => null },
    { path: "/caf%C3%A9/:id", render: () => null },
    { path: "/files/*rest", render: () => null },
  ]);
  assert.equal(matcher(url("/"))!.route.path, "/");
  assert.equal(matcher(url("/café/a%2Fb/"))!.params.id, "a/b");
  assert.equal(matcher(url("/caf%C3%A9/%252F"))!.params.id, "%2F");
  assert.equal(matcher(url("/files"))!.params.rest, "");
  assert.equal(matcher(url("/files/a%2Fb/c/"))!.params.rest, "a/b/c");
  for (const path of ["/Café/id", "/café/id//", "/café//", "/files//", "/café/%FF", "/café/%ZZ", "/nope"]) assert.equal(matcher(url(path)), null);
});
test("compiled routes snapshot definitions, preserve declaration order, and isolate URL/params", () => {
  assert.equal(typeof api.compileRoutes, "function");
  const first = { path: "/:id", render: () => "first" },
    routes = [first, { path: "/a", render: () => "second" }];
  const matcher = api.compileRoutes(routes);
  first.path = "/changed";
  first.render = () => "changed";
  routes.length = 0;
  const input = url("/a?q=one#fragment"),
    match = matcher(input)!;
  // Fixture renders ignore their (data, match) arguments.
  assert.equal((match.route.render as () => string)(), "first");
  assert.equal(match.route.path, "/:id");
  assert.equal(match.url.search, "?q=one");
  assert.equal(match.url.hash, "#fragment");
  input.search = "?mutated";
  match.url.hash = "#mutated";
  assert.equal(matcher(url("/a?q=one#fragment"))!.url.href, "https://routes.test/a?q=one#fragment");
  assert.equal(Object.getPrototypeOf(match.params), null);
  assert.equal(Object.isFrozen(match.params), true);
});
test("compile rejects malformed patterns eagerly", () => {
  assert.equal(typeof api.compileRoutes, "function");
  for (const path of ["relative", "//", "/a//b", "/:", "/*", "/:id/:id", "/*rest/more", "/:id/*id", "/bad%ZZ", "/a?x", "/a#x", "/a:b", "/a*b"])
    assert.throws(() => api.compileRoutes([{ path, render: () => null }]), /route|path|pattern|segment|parameter|splat/i, path);
});
const server = (await import("../server-router.ts").catch(() => ({}))) as typeof import("../server-router.ts");
for (const [name, compile] of [
  ["linear (browser)", (routes: Parameters<typeof api.compileRoutes>[0]) => api.compileRoutes(routes)],
  ["bucketed (server)", (routes: Parameters<typeof api.compileRoutes>[0]) => server.compileRoutes(routes)],
] as const)
  test(`${name} matching keeps declaration order across buckets, the static map and decoded slashes`, () => {
    const route = (path: string) => ({ path, render: () => path });
    const matcher = compile([route("/:any/edit"), route("/a/edit"), route("/a/b"), route("/a%2Fb"), route("/*rest"), route("/z")]);
    // An earlier parameter route wins over a later static path (no static-map short circuit).
    assert.equal(matcher(url("/a/edit"))!.route.path, "/:any/edit");
    assert.equal(matcher(url("/a/edit"))!.params.any, "a");
    assert.equal(matcher(url("/a/b"))!.route.path, "/a/b");
    // `%2F` stays inside its segment: `/a%2Fb` is one segment, never `/a/b`.
    assert.equal(matcher(url("/a%2Fb"))!.route.path, "/a%2Fb");
    // An earlier splat shadows later routes, the root included.
    assert.equal(matcher(url("/z"))!.route.path, "/*rest");
    assert.equal(matcher(url("/"))!.params.rest, "");
    assert.equal(matcher(url("/q/r"))!.params.rest, "q/r");
    // Static hits share no mutable state: params frozen, URL fresh per call.
    const one = matcher(url("/a/b"))!,
      two = matcher(url("/a/b"))!;
    assert.equal(Object.isFrozen(one.params), true);
    assert.notEqual(one.url, two.url);
  });
test("route tables compile their paths once per array and define only the matched route (RA1)", () => {
  assert.equal(typeof api.routeMatcher, "function");
  const paths = ["/a/:id", "/a/b", "/b", "/b/c/*rest", "/"];
  const defined: number[] = [];
  const route = (index: number) => (defined.push(index), { path: paths[index]!, render: () => index });
  const table = { paths, route };
  const matcher = api.routeMatcher(table);
  // An earlier param route wins over a later static one; static paths with no earlier dynamic rival hit the map.
  assert.equal(matcher(url("/a/b"))!.route.path, "/a/:id");
  assert.equal(matcher(url("/a/b"))!.params.id, "b");
  assert.equal(matcher(url("/b"))!.route.path, "/b");
  assert.equal(matcher(url("/b/c/x/y"))!.params.rest, "x/y");
  assert.equal(matcher(url("/"))!.route.render(undefined, null!), 4);
  assert.equal(matcher(url("/nope")), null);
  assert.deepEqual(defined, [0, 0, 2, 3, 4]);
  // Same paths array: the compiled matcher is shared, so a second Router compiles nothing.
  const again = api.routeMatcher({ paths, route });
  assert.equal(again(url("/b"))!.route.path, "/b");
  // Definitions must name their table path.
  assert.throws(() => api.routeMatcher({ paths, route: () => ({ path: "/other", render: () => null }) })(url("/b")), /must equal its paths entry/);
  assert.throws(() => api.routeMatcher({ paths: ["nope"], route }), /absolute path pattern/);
  // Arrays still compile as definitions (snapshotted).
  assert.equal(api.routeMatcher([{ path: "/x", render: () => "x" }])(url("/x"))!.route.path, "/x");
});

test("browser (linear) and server (bucketed) matchers agree on every path (bucket matcher is server-only)", async () => {
  const patterns = ["/", "/:a", "/a", "/a/:b", "/a/b", "/:x/b", "/a/*rest", "/b/c", "/b/:c/d", "/a%2Fb", "/c/*all", "/:p/:q/:r", "/b", "/z/z"];
  const paths = [
    "/",
    "/a",
    "/b",
    "/a/b",
    "/a/c",
    "/x/b",
    "/a/b/c",
    "/b/c",
    "/b/x/d",
    "/a%2Fb",
    "/c",
    "/c/1/2",
    "/p/q/r",
    "/z/z",
    "/z",
    "/q/w/e/r",
    "/%FF",
    "/a//b",
  ];
  // Every rotation of the declaration order: both matchers must return the same route and params.
  for (let shift = 0; shift < patterns.length; shift++) {
    const order = [...patterns.slice(shift), ...patterns.slice(0, shift)].map((path) => ({ path, render: () => path }));
    const linear = api.compileRoutes(order),
      bucketed = server.compileRoutes(order);
    for (const path of paths) {
      const one = linear(url(path)),
        two = bucketed(url(path));
      assert.deepEqual(one && [one.route.path, { ...one.params }], two && [two.route.path, { ...two.params }], `${path} (rotation ${shift})`);
    }
  }
  // The browser router module graph never reaches the bucketed matcher.
  const { readFile } = await import("node:fs/promises");
  for (const file of ["../router.ts", "../dom-router.ts"]) assert.doesNotMatch(await readFile(new URL(file, import.meta.url), "utf8"), /from "\.\/router-buckets/);
});
