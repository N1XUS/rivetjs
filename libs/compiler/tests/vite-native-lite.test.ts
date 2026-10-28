// PRESS-LITE and VCLS must preserve the original component graph while introducing a native twin.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build, type Rollup } from "vite";
import { rivet } from "../vite.ts";

const page = (handler: string, shared = false) => `import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
${shared ? 'import { Chip } from "@rivetjs/ui/chip";' : ""}
export default function Page() {
  const n = signal(0);
  return <main><output>{n()}</output><Button variant="ghost" onPress={${handler}}>Add</Button>${shared ? "<Chip>{n()}</Chip>" : ""}</main>;
}`;

test("native twins do not retain or split the original class resolver and registry", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-native-lite-"));
  const previous = process.env.RIVET_NATIVE_LITE;
  try {
    await writeFile(resolve(root, "lite.tsx"), page("() => n.update(v => v + 1)"));
    await writeFile(resolve(root, "full.tsx"), page("event => n.set(event.shiftKey ? 2 : 1)", true));
    await writeFile(resolve(root, "host.tsx"), "export default function Host(props) { return <div>{props.children}</div>; }");
    const bundle = async (off: boolean) => {
      if (off) process.env.RIVET_NATIVE_LITE = "0";
      else delete process.env.RIVET_NATIVE_LITE;
      const outputs = new Map<string, Rollup.OutputChunk>();
      await build({
        root,
        configFile: false,
        logLevel: "silent",
        plugins: [
          rivet({
            serverExports: { modules: ["lite.tsx", "full.tsx"] },
            resume: { modules: ["lite.tsx", "full.tsx", "host.tsx"], roots: ["host.tsx"] },
          }),
          {
            name: "capture-native-chunks",
            generateBundle(_options, bundle) {
              for (const output of Object.values(bundle)) if (output.type === "chunk") outputs.set(output.fileName, output);
            },
          },
        ],
        build: { write: false, rollupOptions: { input: [resolve(root, "lite.tsx"), resolve(root, "full.tsx")] } },
      });
      const closure = (file: string) => {
        const entry = [...outputs.values()].find((output) => output.facadeModuleId === resolve(root, file));
        assert.ok(entry, file);
        const seen = new Set<string>();
        const pending = [entry.fileName];
        while (pending.length) {
          const next = pending.pop()!;
          if (seen.has(next)) continue;
          seen.add(next);
          pending.push(...outputs.get(next)!.imports);
        }
        return [...seen].flatMap((name) => outputs.get(name)!.moduleIds).sort();
      };
      return { lite: closure("lite.tsx"), full: closure("full.tsx") };
    };
    const before = await bundle(true);
    const after = await bundle(false);
    assert.ok(before.full.some((id) => id.includes("/cdk/button/")));
    assert.deepEqual(after.full, before.full, "the kept Button's module closure is unchanged");
    assert.ok(after.lite.some((id) => id.endsWith("/button-lite.tsx")));
    assert.ok(!after.lite.some((id) => id.includes("/cdk/button/")), "native callers drop the cdk Button");
    const registry = after.lite.filter((id) => id.startsWith("\0rivet-class-registry"));
    assert.equal(registry.length, 1);
    assert.ok(
      registry.every((id) => !after.full.includes(id)),
      "new and original class effects cannot split a shared registry",
    );
  } finally {
    if (previous === undefined) delete process.env.RIVET_NATIVE_LITE;
    else process.env.RIVET_NATIVE_LITE = previous;
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
