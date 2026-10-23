// T8: one app with a Preact island (`*.preact.tsx`) and a React island (`*.react.tsx`), both `.tsx` next to Rivet
// `.tsx`. Client build: each island's JSX targets its own framework (`rivet:<fw>:jsx-source` pragmas; no Rivet
// jsx-runtime in an island chunk), one Preact copy shared by the Preact island chunks, React and Preact in separate
// chunks. SSR build: the page renders both islands through their adapters (`useId` masked by the island id).
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, type Plugin } from "vite";
import { rivet } from "@rivetjs/compiler/vite";
import { react } from "../../bridge-react/vite.ts";
import { preact } from "../vite.ts";

interface Manifest {
  islands?: Record<string, string>;
  deps?: Record<string, string[]>;
}

test("Preact + React islands in one app: own JSX runtime each, one Preact copy, both render on the server", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/bridge-preact-build-"));
  try {
    await mkdir(resolve(root, "src"));
    await writeFile(resolve(root, "index.html"), "<!doctype html>\n<p>static</p>\n");
    await writeFile(
      resolve(root, "src/Counter.preact.tsx"),
      `import { useId, useState } from "preact/hooks";
export function Counter(props: { count: number }) {
  const [n, setN] = useState(props.count);
  return <button id={useId()} class="p" onClick={() => setN(n + 1)}>{n}</button>;
}
`,
    );
    await writeFile(
      resolve(root, "src/Clock.preact.tsx"),
      `import { useEffect, useState } from "preact/hooks";
export function Clock() {
  const [t, setT] = useState(0);
  useEffect(() => void setT(1), []);
  return <time>{t}</time>;
}
`,
    );
    await writeFile(
      resolve(root, "src/Note.react.tsx"),
      `export function Note(props: { text: string }) {
  return <i className="r">{props.text}</i>;
}
`,
    );
    await writeFile(
      resolve(root, "src/page.tsx"),
      `import { Counter } from "./Counter.preact.tsx";
import { Clock } from "./Clock.preact.tsx";
import { Note } from "./Note.react.tsx";
export function Page() {
  return <main><Counter client="load" count={1} /><Clock client="visible" /><Note client="idle" text="hi" /></main>;
}
`,
    );
    await writeFile(
      resolve(root, "src/entry-server.tsx"),
      `import { resumableToString } from "@rivetjs/runtime/server-resume";
import { Page } from "./page.tsx";
export const render = (manifest: never) => resumableToString(() => <Page />, { manifest });
`,
    );
    const chunks: { file: string; modules: string[] }[] = [];
    const record: Plugin = {
      name: "record-chunks",
      generateBundle(_, bundle) {
        for (const out of Object.values(bundle)) if (out.type === "chunk") chunks.push({ file: out.fileName, modules: Object.keys(out.modules) });
      },
    };
    const plugins = () => [rivet({ resume: { modules: ["src/page.tsx"] }, bridges: [preact(), react()] })];
    await build({ configFile: false, root, logLevel: "silent", plugins: [...plugins(), record], build: { outDir: "dist", minify: false } });
    const manifest = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8")) as Manifest;
    assert.deepEqual(Object.keys(manifest.islands ?? {}).sort(), ["src/Clock.preact.tsx#Clock", "src/Counter.preact.tsx#Counter", "src/Note.react.tsx#Note"]);

    const rivetJsx = chunks.filter((chunk) => chunk.modules.some((id) => id.endsWith("/libs/runtime/jsx-runtime.ts")));
    assert.deepEqual(
      rivetJsx.map((chunk) => chunk.file),
      [],
      "Rivet jsx-runtime bundled",
    );
    const of = (pattern: RegExp) => chunks.flatMap((chunk) => chunk.modules.filter((id) => pattern.test(id)).map((id) => ({ id, chunk: chunk.file })));
    const preactModules = of(/\/node_modules\/preact\//);
    const reactModules = of(/\/node_modules\/(react|react-dom|scheduler)\//);
    for (const entry of ["preact/dist/preact.", "preact/hooks/dist/hooks.", "preact/jsx-runtime/dist/jsxRuntime."])
      assert.ok(
        preactModules.some(({ id }) => id.includes("/node_modules/" + entry)),
        entry + " bundled: " + preactModules.map(({ id }) => id).join(" "),
      );
    const dirs = new Set(preactModules.map(({ id }) => id.match(/^(.*\/node_modules\/preact)\//)?.[1]));
    assert.equal(dirs.size, 1, "preact dirs: " + [...dirs].join(" "));
    const homes = new Set(preactModules.map(({ chunk }) => chunk));
    assert.equal(homes.size, 1, "preact chunks: " + [...homes].join(" "));
    const home = [...homes][0]!;
    assert.ok(!reactModules.some(({ chunk }) => chunk === home), "React and Preact share a chunk");
    assert.ok(
      reactModules.some(({ id }) => id.endsWith("/node_modules/react/jsx-runtime.js")),
      "React island compiled against React",
    );
    for (const key of ["src/Clock.preact.tsx#Clock", "src/Counter.preact.tsx#Counter"]) {
      const url = manifest.islands![key]!;
      const closure = [url, ...(manifest.deps?.[url] ?? [])];
      assert.ok(
        closure.some((file) => file.endsWith(home)),
        url + " closure lacks " + home + ": " + closure.join(" "),
      );
    }

    await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: plugins(),
      build: { outDir: "dist-server", ssr: "src/entry-server.tsx", minify: false },
    });
    const { render } = (await import(pathToFileURL(resolve(root, "dist-server/entry-server.js")).href)) as { render(m: Manifest): Promise<string> };
    const html = await render(manifest);
    assert.match(html, /<rivet-island data-ri="(i\d+)" style="display:contents"><button id="P\1-0" class="p">1<\/button><\/rivet-island>/);
    assert.match(html, /<rivet-island data-ri="i\d+" style="display:contents"><time>0<\/time><\/rivet-island>/);
    assert.match(html, /<rivet-island data-ri="i\d+" style="display:contents"><i class="r">hi<\/i><\/rivet-island>/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
