import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findCompiler, workspaceCompilerWasm, type Compiler } from "../index.ts";

export const repo = fileURLToPath(new URL("../../../", import.meta.url));

export const compiler: Compiler = findCompiler([workspaceCompilerWasm(repo)])!;

/** Temp app inside the repo (workspace packages resolve); files: root-relative path → text. */
export function tempApp(files: Record<string, string>): string {
  mkdirSync(join(repo, ".artifacts"), { recursive: true });
  const root = mkdtempSync(join(repo, ".artifacts", "language-core-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
