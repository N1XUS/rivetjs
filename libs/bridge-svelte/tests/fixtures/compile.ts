import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { compile } from "svelte/compiler";
import type { Component } from "svelte";

/** Compile real SFCs against the installed server runtime, keeping generated modules out of source control. */
export async function fixture(name: string, async = false): Promise<{ component: Component<Record<string, unknown>>; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(fileURLToPath(new URL("./.compiled-", import.meta.url)));
  try {
    const filename = fileURLToPath(new URL(name + ".svelte", import.meta.url));
    const source = await readFile(filename, "utf8");
    const result = compile(source, { filename, generate: "server", css: "external", experimental: { async } });
    const output = join(dir, name + ".mjs");
    await writeFile(output, result.js.code);
    return { component: (await import(pathToFileURL(output).href)).default, cleanup: () => rm(dir, { recursive: true, force: true }) };
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}
