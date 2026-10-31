import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build, type Rollup } from "vite";
import { rivet } from "@rivetjs/compiler/vite";

test("composer helpers stay below 2 KiB when built alongside StreamingText", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/chat-payload-"));
  try {
    await writeFile(resolve(root, "composer.tsx"), 'export { autosizeTextArea, selectedFiles } from "@rivetjs/cdk/chat";');
    await writeFile(resolve(root, "streaming.tsx"), 'export { StreamingText } from "@rivetjs/ui/streaming-text";');
    const chunks = new Map<string, Rollup.OutputChunk>();
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [
        rivet(),
        {
          name: "capture-chat-payload",
          generateBundle(_options, bundle) {
            for (const chunk of Object.values(bundle)) if (chunk.type === "chunk") chunks.set(chunk.fileName, chunk);
          },
        },
      ],
      build: {
        write: false,
        minify: true,
        rollupOptions: {
          preserveEntrySignatures: "strict",
          input: { composer: resolve(root, "composer.tsx"), streaming: resolve(root, "streaming.tsx") },
        },
      },
    });
    const entry = (file: string) => {
      const chunk = [...chunks.values()].find((chunk) => chunk.facadeModuleId === resolve(root, file));
      assert.ok(chunk, file);
      return chunk;
    };
    assert.ok(entry("streaming.tsx").exports.includes("StreamingText"));
    const pending = [entry("composer.tsx").fileName];
    const seen = new Set<string>();
    let bytes = 0;
    while (pending.length) {
      const name = pending.pop()!;
      if (seen.has(name)) continue;
      seen.add(name);
      const chunk = chunks.get(name)!;
      bytes += Buffer.byteLength(chunk.code);
      pending.push(...chunk.imports);
    }
    assert.ok(bytes <= 2048, `composer static JS closure must exclude unrelated text pacing: ${bytes} > 2048 bytes`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
