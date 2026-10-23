// Source packages (`"rivet": { "source": true }`): .tsx compiled even under node_modules and, in
// resume apps, in resume mode when a resume module imports them, with `<package>/<path>` symbol ids.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";
import { rivet } from "../vite.ts";

test("source package .tsx under node_modules resume-compiles with package boundary names (client + server)", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-source-pkg-"));
  try {
    const pkg = resolve(root, "node_modules/@x/widgets");
    await mkdir(resolve(pkg, "toggle"), { recursive: true });
    await writeFile(
      resolve(pkg, "package.json"),
      JSON.stringify({ name: "@x/widgets", type: "module", rivet: { source: true }, exports: { "./*": "./*/index.tsx" } }),
    );
    await writeFile(
      resolve(pkg, "toggle/index.tsx"),
      `import { signal } from "@rivetjs/reactivity";
import { Inner } from "../inner/index.tsx";
export function Toggle() {
  const on = signal(false);
  return <div><button aria-pressed={on() ? "true" : "false"} onClick={() => on.set(!on())}>WIDGET_BODY</button><Inner /></div>;
}
`,
    );
    await mkdir(resolve(pkg, "inner"));
    await writeFile(resolve(pkg, "inner/index.tsx"), `export function Inner() { return <i onClick={() => console.log("inner")}>inner</i>; }\n`);
    // A plain (non-source) package: never compiled, left to Vite as is.
    const plain = resolve(root, "node_modules/@x/plain");
    await mkdir(plain, { recursive: true });
    await writeFile(resolve(plain, "package.json"), JSON.stringify({ name: "@x/plain", type: "module", exports: { ".": "./index.js" } }));
    await writeFile(resolve(plain, "index.js"), "export const PLAIN = 1;\n");
    await mkdir(resolve(root, "src"));
    await writeFile(
      resolve(root, "src/page.tsx"),
      `import { Toggle } from "@x/widgets/toggle";
import { PLAIN } from "@x/plain";
export function Page() { return <main data-n={PLAIN}><Toggle /></main>; }
`,
    );
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    const plugins = () => [rivet({ resume: { modules: ["src/page.tsx"] } })];
    await build({ configFile: false, root, logLevel: "silent", plugins: plugins(), build: { outDir: "dist", minify: false } });
    const manifest = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8")) as { symbols: Record<string, string> };
    const ids = Object.keys(manifest.symbols).sort();
    assert.ok(ids.includes("@x/widgets/toggle/index.tsx#Toggle"), ids.join(" "));
    assert.ok(ids.includes("@x/widgets/inner/index.tsx#Inner"), "transitively imported source modules resume too: " + ids.join(" "));
    await build({ configFile: false, root, logLevel: "silent", plugins: plugins(), build: { outDir: "dist-server", ssr: "src/page.tsx", minify: false } });
    const server = await readFile(resolve(root, "dist-server/page.js"), "utf8");
    assert.match(server, /"@x\/widgets\/toggle\/index\.tsx#Toggle"/, "server output names the package boundary");
    assert.match(server, /@x\/plain|PLAIN = 1/, "plain packages untouched");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("sourcePackages: a linked @rivetjs/* source package's components are boundaries named by the package (server + client agree)", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-source-linked-"));
  // Workspace-linked: the package lives outside the app, node_modules holds a symlink.
  const pkg = root + "-ui";
  try {
    await mkdir(resolve(pkg, "button"), { recursive: true });
    await writeFile(
      resolve(pkg, "package.json"),
      JSON.stringify({ name: "@rivetjs/zz-ui", type: "module", rivet: { source: true }, exports: { "./*": "./*/index.tsx" } }),
    );
    await writeFile(
      resolve(pkg, "button/index.tsx"),
      `export function Button(props: { onPress: () => void; children?: unknown }) { return <button onClick={() => props.onPress()}>{props.children}</button>; }\n`,
    );
    await mkdir(resolve(root, "node_modules/@rivetjs"), { recursive: true });
    await symlink(pkg, resolve(root, "node_modules/@rivetjs/zz-ui"), "dir");
    await mkdir(resolve(root, "src"));
    await writeFile(
      resolve(root, "src/page.tsx"),
      `import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/zz-ui/button";
export function Page() { const n = signal(0); return <main><Button onPress={() => n.set(n() + 1)}>+</Button><p>{n()}</p></main>; }
`,
    );
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    const plugins = () => [rivet({ resume: { modules: ["src/page.tsx"] } })];
    await build({ configFile: false, root, logLevel: "silent", plugins: plugins(), build: { outDir: "dist", minify: false } });
    await build({ configFile: false, root, logLevel: "silent", plugins: plugins(), build: { outDir: "dist-server", ssr: "src/page.tsx", minify: false } });
    const server = await readFile(resolve(root, "dist-server/page.js"), "utf8");
    const manifest = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8")) as { symbols: Record<string, string> };
    for (const name of ["src/page.tsx#Page", "@rivetjs/zz-ui/button/index.tsx#Button"]) {
      assert.ok(server.includes(JSON.stringify(name)), `the server output names ${name}: ` + server);
      assert.ok(name in manifest.symbols, `the client build has ${name}: ` + Object.keys(manifest.symbols).join(" "));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(pkg, { recursive: true, force: true });
  }
});
