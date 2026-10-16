import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

/** Split UI output without changing URLs or the checked source build. Each Worker stays under the Free file limit. */
export async function stageUIAssets(root: string): Promise<{ site: number; assets: number }> {
  const client = resolve(root, "dist/client");
  const output = resolve(root, "dist/cloudflare");
  const entries = await readdir(client);
  await rm(output, { recursive: true, force: true });
  for (const name of ["site", "assets"]) await mkdir(join(output, name), { recursive: true });
  for (const name of entries) {
    if (name === ".vite") continue;
    const worker = name === "assets" || name === "pagefind" ? "assets" : "site";
    await cp(join(client, name), join(output, worker, name), { recursive: true, mode: constants.COPYFILE_FICLONE });
  }
  await cp(join(client, "_headers"), join(output, "assets/_headers"));
  const count = async (name: string) => (await readdir(join(output, name), { recursive: true, withFileTypes: true })).filter((entry) => entry.isFile()).length;
  const result = { site: await count("site"), assets: await count("assets") };
  for (const [worker, files] of Object.entries(result)) {
    if (files > 20_000) throw new Error(`UI ${worker} Worker has ${files} files; Cloudflare Free allows 20,000. Repartition before deploying.`);
  }
  console.log(`Cloudflare UI: ${result.site} page files, ${result.assets} asset/search files (limit 20,000 per Worker)`);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = process.argv[2];
  if (!app || !["apps/docs", "apps/cdk-docs", "apps/ui-docs"].includes(app)) {
    throw new Error("Usage: npm run docs:build:cloudflare -- apps/<docs|cdk-docs|ui-docs>");
  }
  const repo = fileURLToPath(new URL("../", import.meta.url));
  if (process.platform === "linux") {
    const { default: chromium, inflate, setupLambdaEnvironment } = await import("@sparticuz/chromium");
    const bin = fileURLToPath(new URL("../bin/", import.meta.resolve("@sparticuz/chromium")));
    // Cloudflare's unprivileged build image has no Chromium system libraries.
    await inflate(join(bin, "al2023.tar.br"));
    setupLambdaEnvironment(join(tmpdir(), "al2023/lib"));
    process.env.DOCS_KIT_CHROMIUM_PATH = await chromium.executablePath();
  } else {
    const install = spawnSync(process.execPath, ["node_modules/playwright/cli.js", "install", "chromium"], { cwd: repo, stdio: "inherit" });
    if (install.error) throw install.error;
    if (install.status !== 0) process.exit(install.status ?? 1);
  }
  const env = {
    ...process.env,
    DOCS_ORIGIN: "https://rivetjs.severyn.pro",
    CDK_DOCS_ORIGIN: "https://cdk.rivetjs.severyn.pro",
    UI_DOCS_ORIGIN: "https://ui.rivetjs.severyn.pro",
  };
  const result = spawnSync(process.execPath, ["libs/docs-kit/cli.ts", "build", app], { cwd: repo, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (app === "apps/ui-docs") await stageUIAssets(resolve(repo, app));
}
