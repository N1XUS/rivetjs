// VCLS end to end (`static-class.ts` + the derived walk, `vite.ts`) over the real `@rivetjs/ui` Button: a resumed page
// whose Buttons all pass constant variant props ships neither the button definition (its variant table) nor the ui
// resolver; the server and the browser render the same class as today; a page with one non-constant variant, a class
// override or a `ButtonGroup` keeps today's code (default build scope) or imports the registration (`RIVET_STATIC_CLASS=page`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { hasDerivedModel } from "../index.ts";
import { rivet } from "../vite.ts";

const PAGES: Record<string, string> = {
  // The ui-counter example: default + ghost, a live `isDisabled` (not a class prop), handlers.
  proven: `import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
export default function Page() {
  const n = signal(0);
  return (
    <main>
      <output>{n()}</output>
      <Button onPress={() => n.update((v) => v + 1)}>Inc</Button>
      <Button variant="ghost" size="sm" isDisabled={n() === 0} onPress={() => n.set(0)}>Reset</Button>
      <Button.Root fullWidth isIconOnly variant={"danger"}>X</Button.Root>
    </main>
  );
}
`,
  // Proven Buttons next to another ui component (Chip: the same resolver runtime): the button table leaves, the runtime
  // stays reachable from button (build scope), so no other module changes chunk.
  shared: `import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Chip } from "@rivetjs/ui/chip";
export default function Page() {
  const n = signal(0);
  return (
    <main>
      <output>{n()}</output>
      <Chip>{String(n())}</Chip>
      <Button variant="ghost" onPress={() => n.update((v) => v + 1)}>Inc</Button>
    </main>
  );
}
`,
  // A variant from state: the class can change, the resolver ships.
  dynamic: `import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
export default function Page() {
  const n = signal(0);
  return (
    <main>
      <output>{n()}</output>
      <Button onPress={() => n.update((v) => v + 1)}>Inc</Button>
      <Button variant={n() > 0 ? "danger" : "ghost"} onPress={() => n.set(0)}>Reset</Button>
    </main>
  );
}
`,
  // A class override: tailwind-merge semantics stay the resolver's.
  override: `import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
export default function Page() {
  const n = signal(0);
  return (
    <main>
      <output>{n()}</output>
      <Button class="w-full" onPress={() => n.update((v) => v + 1)}>Inc</Button>
    </main>
  );
}
`,
  // A group context (size / variant from the group): the Buttons inside call the resolver.
  group: `import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";
export default function Page() {
  const n = signal(0);
  return (
    <main>
      <output>{n()}</output>
      <ButtonGroup variant="tertiary" size="lg">
        <Button onPress={() => n.update((v) => v + 1)}>Inc</Button>
      </ButtonGroup>
    </main>
  );
}
`,
  // A value use: the component flows elsewhere (registered by the module that holds the value).
  value: `import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
const Comp = Button;
export default function Page() {
  const n = signal(0);
  return (
    <main>
      <output>{n()}</output>
      <Comp variant="ghost" onPress={() => n.update((v) => v + 1)}>Inc</Comp>
    </main>
  );
}
`,
};
const SERVER = `import { createApp } from "@rivetjs/router/server";
import Page from "./page.tsx";
const entry = {
  routes: [{ id: "p", pattern: "/*rest", page: true, layouts: [] }],
  universal: {},
  page: () => () => Page({}),
  document: () => ({ start: "<!doctype html><html><body>", end: "</body></html>" }),
};
export const render = async (manifest) => (await createApp({ entry, manifest, csp: false })(new Request("http://x/"))).text();
`;

async function buildApp(kind: string, roots: string[], options: { mode?: "0" | "page" } = {}) {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-static-class-"));
  roots.push(root);
  await mkdir(resolve(root, "src"));
  await writeFile(resolve(root, "src/page.tsx"), PAGES[kind]!);
  await writeFile(resolve(root, "src/server.tsx"), SERVER);
  await writeFile(resolve(root, "src/app.tsx"), "export default function Root(props) {\n  return <div>{props.children}</div>;\n}\n");
  await writeFile(resolve(root, "index.html"), "<!doctype html><p>client</p>");
  const plugin = () =>
    rivet({
      serverExports: { modules: ["src/page.tsx"] },
      resume: { modules: ["src/page.tsx", "src/app.tsx"], roots: ["src/app.tsx"] },
    });
  const before = process.env.RIVET_STATIC_CLASS;
  if (options.mode) process.env.RIVET_STATIC_CLASS = options.mode;
  try {
    await build({ root, configFile: false, logLevel: "silent", plugins: [plugin()], build: { outDir: "client-dist", manifest: true } });
    await build({ root, configFile: false, logLevel: "silent", plugins: [plugin()], build: { outDir: "server-dist", ssr: "src/server.tsx" } });
  } finally {
    if (before === undefined) delete process.env.RIVET_STATIC_CLASS;
    else process.env.RIVET_STATIC_CLASS = before;
  }
  const manifest = JSON.parse(await readFile(resolve(root, "client-dist/.vite/rivet-resume.json"), "utf8"));
  const { render } = await import(pathToFileURL(resolve(root, "server-dist/server.js")).href);
  const html: string = await render(manifest);
  const assets = resolve(root, "client-dist/assets");
  const files = await readdir(assets);
  // What the page can load: the chunks its HTML names and their static imports.
  const reach = new Set<string>();
  const queue = [...html.matchAll(/\/assets\/([\w.-]+\.js)/g)].map((m) => m[1]!);
  while (queue.length) {
    const file = queue.pop()!;
    if (reach.has(file)) continue;
    reach.add(file);
    const text = await readFile(resolve(assets, file), "utf8");
    for (const m of text.matchAll(/from\s*"\.\/([\w.-]+\.js)"|import\s*"\.\/([\w.-]+\.js)"/g)) queue.push((m[1] ?? m[2])!);
  }
  const loaded = (await Promise.all([...reach].map((f) => readFile(resolve(assets, f), "utf8")))).join("\n");
  const css = (await Promise.all(files.filter((f) => f.endsWith(".css")).map((f) => readFile(resolve(assets, f), "utf8")))).join("\n");
  return { html, loaded, css, root };
}

// The variant table's text (the definition's options) and the ui resolver's error text.
const TABLE = /button--tertiary/;
const RESOLVER = /ui tv: no /;
const classes = (html: string) => [...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1]);

test.skipIf(!hasDerivedModel())(
  "constant Button variants ship no definition or resolver; other sites keep today's code",
  async () => {
    const roots: string[] = [];
    try {
      const proven = await buildApp("proven", roots);
      const today = await buildApp("proven", roots, { mode: "0" });
      assert.deepEqual(classes(proven.html), classes(today.html));
      assert.deepEqual(classes(proven.html), [
        "button button--md button--primary",
        "button button--sm button--ghost",
        "button button--full-width button--icon-only button--md button--danger",
      ]);
      assert.ok(TABLE.test(today.loaded) && RESOLVER.test(today.loaded), "today: the definition and the resolver ship");
      assert.ok(!proven.html.includes("$cls"), "the hidden prop is never rendered");
      assert.ok(!TABLE.test(proven.loaded), "no variant table");
      assert.ok(!RESOLVER.test(proven.loaded), "no resolver");
      assert.ok(proven.css.includes(".button--ghost"), "the button stylesheet stays");
      const shared = await buildApp("shared", roots);
      const sharedToday = await buildApp("shared", roots, { mode: "0" });
      assert.deepEqual(classes(shared.html), classes(sharedToday.html));
      assert.ok(!TABLE.test(shared.loaded), "shared runtime: no button table");
      assert.ok(RESOLVER.test(shared.loaded), "shared runtime: the resolver stays");
      for (const kind of ["dynamic", "override", "group", "value"]) {
        const page = await buildApp(kind, roots);
        assert.ok(TABLE.test(page.loaded), kind + ": the definition ships");
        assert.ok(page.css.includes(".button--ghost"), kind + ": stylesheet");
        // Per-page scope: the family stays active, the flagged module imports the registration.
        const scoped = await buildApp(kind, roots, { mode: "page" });
        assert.ok(TABLE.test(scoped.loaded) && RESOLVER.test(scoped.loaded), kind + " (page scope): the registration ships");
        assert.deepEqual(classes(scoped.html), classes(page.html), kind + " (page scope): same classes");
      }
    } finally {
      if (!process.env.KEEP) for (const root of roots) await rm(root, { recursive: true, force: true });
    }
  },
  300_000,
);
