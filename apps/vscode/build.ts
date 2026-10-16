// Stage the extension in `dist/extension/` (an unpacked VSIX root): manifest, LICENSE, CommonJS extension
// bundle and node_modules/@rivetjs/typescript-plugin (VS Code resolves `typescriptServerPlugins` there).
// Try it: code --extensionDevelopmentPath=apps/vscode/dist/extension <app folder>
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { buildPlugin, distDir as pluginDist } from "../../libs/typescript-plugin/build.ts";

export const extensionDir = fileURLToPath(new URL("./dist/extension/", import.meta.url));

export async function buildExtension(): Promise<void> {
  rmSync(extensionDir, { recursive: true, force: true });
  await buildPlugin();
  const plugin = extensionDir + "node_modules/@rivetjs/typescript-plugin/";
  mkdirSync(plugin + "dist", { recursive: true });
  await build({
    entryPoints: [fileURLToPath(new URL("./extension.ts", import.meta.url))],
    outfile: extensionDir + "extension.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node18",
    external: ["vscode"],
    logLevel: "warning",
  });
  // VSIX metadata `vsce package` asks for when missing: LICENSE file, `repository` (the workspace root's).
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("./manifest.json", import.meta.url)), "utf8")) as Record<string, unknown>;
  const { repository } = JSON.parse(readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8")) as { repository?: unknown };
  if (repository && !manifest["repository"]) manifest["repository"] = repository;
  writeFileSync(extensionDir + "package.json", JSON.stringify(manifest, null, 2) + "\n");
  copyFileSync(fileURLToPath(new URL("../../LICENSE", import.meta.url)), extensionDir + "LICENSE");
  for (const file of ["index.cjs", "rivet_compiler.wasm"]) copyFileSync(pluginDist + file, plugin + "dist/" + file);
  writeFileSync(plugin + "package.json", JSON.stringify({ name: "@rivetjs/typescript-plugin", version: "0.0.0-experimental", main: "./dist/index.cjs" }, null, 2) + "\n");
}

if (import.meta.main) await buildExtension();
