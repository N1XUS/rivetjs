// T6 (T5 review F3): a resumable client build of a Rivet page with two real React islands (`*.react.tsx`, compiled by
// @vitejs/plugin-react through `react()`) bundles ONE copy of react / react-dom / react/jsx-runtime: every React module
// resolves to one package directory and lands in exactly one chunk shared by both island chunks; their JSX targets React
// (`react:jsx-source` pragma) although the repo tsconfig names `@rivetjs/runtime` as the JSX import source.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build, type Plugin } from "vite";
import { rivet } from "@rivetjs/compiler/vite";
import { react } from "../vite.ts";

interface Manifest {
  islands?: Record<string, string>;
  deps?: Record<string, string[]>;
}

test("two React islands: one react / react-dom / jsx-runtime copy, one shared chunk", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/bridge-react-build-"));
  try {
    await mkdir(resolve(root, "src"));
    await writeFile(resolve(root, "index.html"), "<!doctype html>\n<p>static</p>\n");
    await writeFile(
      resolve(root, "src/Counter.react.tsx"),
      `import { useState } from "react";
export function Counter(props: { count: number }) {
  const [n, setN] = useState(props.count);
  return <button onClick={() => setN(n + 1)}>{n}</button>;
}
`,
    );
    await writeFile(
      resolve(root, "src/Clock.react.tsx"),
      `import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
export function Clock() {
  const [t, setT] = useState(0);
  useEffect(() => void setT(1), []);
  return <time>{t}{typeof createPortal}</time>;
}
`,
    );
    await writeFile(
      resolve(root, "src/page.tsx"),
      `import { Counter } from "./Counter.react.tsx";
import { Clock } from "./Clock.react.tsx";
export function Page() {
  return <main><Counter client="load" count={1} /><Clock client="visible" /></main>;
}
`,
    );
    // Every module of every output chunk (React modules by resolved path).
    const chunks: { file: string; modules: string[] }[] = [];
    const record: Plugin = {
      name: "record-chunks",
      generateBundle(_, bundle) {
        for (const out of Object.values(bundle)) if (out.type === "chunk") chunks.push({ file: out.fileName, modules: Object.keys(out.modules) });
      },
    };
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [rivet({ resume: { modules: ["src/page.tsx"] }, bridges: [react()] }), record],
      build: { outDir: "dist", minify: false },
    });
    const manifest = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8")) as Manifest;
    assert.deepEqual(Object.keys(manifest.islands ?? {}).sort(), ["src/Clock.react.tsx#Clock", "src/Counter.react.tsx#Counter"]);

    // The islands' JSX compiled against React (a tsconfig `jsxImportSource: @rivetjs/runtime` must not win).
    const rivetJsx = chunks.filter((chunk) => chunk.modules.some((id) => id.endsWith("/libs/runtime/jsx-runtime.ts")));
    assert.deepEqual(
      rivetJsx.map((chunk) => chunk.file),
      [],
      "Rivet jsx-runtime bundled",
    );
    const reactModules = chunks.flatMap((chunk) =>
      chunk.modules.filter((id) => /\/node_modules\/(react|react-dom|scheduler)\//.test(id)).map((id) => ({ id, chunk: chunk.file })),
    );
    // One package directory per package (no nested / duplicated install, no dev + prod copy).
    for (const pkg of ["react", "react-dom"]) {
      const dirs = new Set(reactModules.map(({ id }) => id.match(new RegExp("^(.*/node_modules/" + pkg + ")/"))?.[1]).filter(Boolean));
      assert.equal(dirs.size, 1, pkg + " dirs: " + [...dirs].join(" "));
    }
    for (const entry of ["react/index.js", "react/jsx-runtime.js", "react-dom/index.js"])
      assert.ok(
        reactModules.some(({ id }) => id.endsWith("/node_modules/" + entry)),
        entry + " bundled: " + reactModules.map(({ id }) => id).join(" "),
      );
    // Each React module in exactly one chunk, and all of them in one chunk that both islands import.
    const where = new Map<string, Set<string>>();
    for (const { id, chunk } of reactModules) where.set(id, (where.get(id) ?? new Set()).add(chunk));
    for (const [id, files] of where) assert.equal(files.size, 1, id + " in " + [...files].join(" "));
    const homes = new Set(reactModules.map(({ chunk }) => chunk));
    assert.equal(homes.size, 1, "react chunks: " + [...homes].join(" "));
    const home = [...homes][0]!;
    for (const url of Object.values(manifest.islands!)) {
      const closure = [url, ...(manifest.deps?.[url] ?? [])];
      assert.ok(
        closure.some((file) => file.endsWith(home)),
        url + " closure lacks " + home + ": " + closure.join(" "),
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
