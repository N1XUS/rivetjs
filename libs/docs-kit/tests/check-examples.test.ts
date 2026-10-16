// Frames-only build transforms (`check-examples`): the router's generated route table / app keep only example frame
// routes, the frames index only the chosen ids; an unexpected generated shape fails loudly.
import { strict as assert } from "node:assert";
import { test } from "vitest";
import { generate } from "../../router/build/codegen.ts";
import { routeTable } from "../../router/build/routes.ts";
import { onlyFramePages, onlyFrameRoutes, onlyFrames } from "../vite.ts";

const fail = (message: string): never => {
  throw new Error(message);
};
const files = generate(
  routeTable([
    "_layout.tsx",
    "index.tsx",
    "(docs)/components/listbox.tsx",
    "examples/[id]/frame/index.tsx",
    "examples/[id]/frame/[...path].tsx",
    "examples/[id].tsx",
  ]),
  { routesDir: "src/routes" },
).files;

test("onlyFrameRoutes keeps the frame routes of .rivet/routes.ts", () => {
  const out = onlyFrameRoutes(files["routes.ts"]!, fail);
  assert.match(out, /examples\/\[id\]\/frame\/index/);
  assert.match(out, /examples\/\[id\]\/frame\/\[\.\.\.path\]/);
  assert.doesNotMatch(out, /components\/listbox|"examples\/\[id\]"|id: "index"/);
  assert.throws(() => onlyFrameRoutes(generate(routeTable(["index.tsx"]), { routesDir: "src/routes" }).files["routes.ts"]!, fail), /no example frame route/);
});

test("onlyFramePages rejects the other page imports of .rivet/app.tsx (indices kept)", () => {
  const app = files["app.tsx"]!;
  const out = onlyFramePages(app, fail)!;
  assert.match(out, /import\("\.\.\/src\/routes\/examples\/\[id\]\/frame\/index\.tsx"\)/);
  assert.doesNotMatch(out, /import\("\.\.\/src\/routes\/\(docs\)/);
  assert.equal(out.split("frames-only build").length - 1, (app.match(/\(\) => import\("\.\.\/src\/routes\//g) ?? []).length - 2);
  assert.equal(onlyFramePages("export const x = 1;", fail), null);
});

test("onlyFrames keeps the chosen ids of the frames index and names missing ones", () => {
  const index = [
    "export const frames = {",
    '  "a": { paths: [""], load: () => import("./example-frames/a.tsx") },',
    '  "b": { paths: [""], load: () => import("./example-frames/b.tsx") },',
    "};",
  ].join("\n");
  const out = onlyFrames(index, new Set(["b"]), fail);
  assert.doesNotMatch(out, /"a"/);
  assert.match(out, /"b"/);
  assert.throws(() => onlyFrames(index, new Set(["c"]), fail), /no live example c/);
});
