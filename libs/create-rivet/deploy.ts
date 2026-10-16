// `--deploy <target>`: the per-platform edits over a starter, as a create-rivet `Overlay`. The router builds the
// platform output itself (`rivetRouter({ adapter })`, libs/router/adapters/CLAUDE.md); here only the project files:
// - every target: `adapter: "<target>"` in vite.config.ts' `rivetRouter({ … })`, `.vercel/` `.netlify/` `.wrangler/`
//   in .gitignore;
// - vercel: `deploy` = `vercel deploy --prebuilt` (deploys `.vercel/output` from `npm run build`);
// - netlify: netlify.toml (build command, `publish = "dist/netlify"`: the Frameworks API has no publish setting);
// - cloudflare: `wrangler` dev dependency, `preview` = `wrangler dev`, `deploy` = `wrangler deploy` (the build writes
//   dist/cloudflare/wrangler.json and points Wrangler at it). No `nodejs_compat` flag: the build sets the flags;
// - bun / deno (server starter only): `start` runs the generated server entry; the Node-only serve.js + Dockerfile go.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commands, type Overlay, type PackageManager, type TemplateId } from "./index.ts";

export const DEPLOY_TARGETS = [
  { id: "vercel", label: "Vercel", hint: "Build Output API (.vercel/output), `vercel deploy --prebuilt`" },
  { id: "netlify", label: "Netlify", hint: "netlify.toml + Netlify Functions (dist/netlify)" },
  { id: "cloudflare", label: "Cloudflare Workers", hint: "Workers + static assets, `wrangler deploy`" },
  { id: "bun", label: "Bun", hint: "`bun dist/server/bun.js` (server template)" },
  { id: "deno", label: "Deno", hint: "`deno run dist/server/deno.js` (server template)" },
] as const;
export type DeployTarget = (typeof DEPLOY_TARGETS)[number]["id"];

/** Wrangler major the cloudflare target was verified with (`wrangler dev --local`, 4.x). */
export const WRANGLER_RANGE = "^4.0.0";

const SERVER_ONLY = new Set<DeployTarget>(["bun", "deno"]);
const IGNORED = [".vercel/", ".netlify/", ".wrangler/"];

export function findDeployTarget(id: string): (typeof DEPLOY_TARGETS)[number] | undefined {
  return DEPLOY_TARGETS.find((target) => target.id === id);
}

/** Why `target` cannot be used with `template`, or `undefined`. */
export function deployProblem(target: DeployTarget, template: TemplateId): string | undefined {
  if (SERVER_ONLY.has(target) && template !== "server") return `--deploy ${target} runs a server: use --template server`;
  return undefined;
}

/** `rivetRouter({ … })` / `rivetRouter()` → with `adapter: "<target>"` first. Throws when the call is missing. */
export function addAdapter(config: string, target: DeployTarget): string {
  if (/rivetRouter\(\s*\{[^}]*\badapter\s*:/.test(config)) throw new Error("vite.config.ts already sets an adapter");
  if (/rivetRouter\(\s*\)/.test(config)) return config.replace(/rivetRouter\(\s*\)/, `rivetRouter({ adapter: "${target}" })`);
  if (/rivetRouter\(\s*\{/.test(config)) return config.replace(/rivetRouter\(\s*\{\s*/, `rivetRouter({ adapter: "${target}", `);
  throw new Error("vite.config.ts has no rivetRouter() call to add the adapter to");
}

/** The overlay for `target` (package manager: the build command written into netlify.toml). */
export function deployOverlay(target: DeployTarget, pm: PackageManager = "npm"): Overlay {
  return {
    name: "deploy-" + target,
    manifest: (pkg) => {
      const scripts = { ...((pkg["scripts"] as Record<string, string> | undefined) ?? {}) };
      const out = { ...pkg, scripts };
      if (target === "vercel") scripts["deploy"] = "vercel deploy --prebuilt";
      if (target === "cloudflare") {
        scripts["preview"] = "wrangler dev";
        scripts["deploy"] = "wrangler deploy";
        out.devDependencies = { ...pkg.devDependencies, wrangler: WRANGLER_RANGE };
      }
      if (target === "bun") scripts["start"] = "bun dist/server/bun.js";
      if (target === "deno") scripts["start"] = "deno run --allow-net --allow-read --allow-env dist/server/deno.js";
      return out;
    },
    edit: (dir) => {
      const written = ["vite.config.ts", ".gitignore"];
      const removed: string[] = [];
      const config = join(dir, "vite.config.ts");
      writeFileSync(config, addAdapter(readFileSync(config, "utf8"), target));
      const gitignore = join(dir, ".gitignore");
      const lines = existsSync(gitignore) ? readFileSync(gitignore, "utf8").split("\n").filter(Boolean) : [];
      writeFileSync(gitignore, [...lines, ...IGNORED.filter((entry) => !lines.includes(entry))].join("\n") + "\n");
      if (target === "netlify") {
        writeFileSync(join(dir, "netlify.toml"), `[build]\n  command = "${commands(pm).run("build")}"\n  publish = "dist/netlify"\n`);
        written.push("netlify.toml");
      }
      const readme = join(dir, "README.md");
      if (existsSync(readme)) {
        const run = commands(pm).run;
        const label = findDeployTarget(target)!.label;
        const how: Record<DeployTarget, string> = {
          vercel: `\`${run("build")}\` also writes \`.vercel/output\` (Build Output API). Deploy it with the Vercel CLI: \`${run("deploy")}\` (\`vercel deploy --prebuilt\`).`,
          netlify: `\`netlify.toml\` makes Netlify run \`${run("build")}\` and publish \`dist/netlify\`; the server function goes to \`.netlify/v1\`. Connect the repository in Netlify, or deploy with the Netlify CLI after a build.`,
          cloudflare: `\`${run("build")}\` writes \`dist/cloudflare\` (worker + static assets + \`wrangler.json\`). \`${run("preview")}\` runs it in the local Workers runtime, \`${run("deploy")}\` uploads it. Keep \`nodejs_compat\` off (the build sets the compatibility flags).`,
          bun: `\`${run("build")}\` writes \`dist/server/bun.js\`; \`${run("start")}\` serves the app with Bun (\`PORT\`, \`HOST\`). Bun must be installed.`,
          deno: `\`${run("build")}\` writes \`dist/server/deno.js\`; \`${run("start")}\` serves the app with Deno (\`PORT\`, \`HOST\`). Deno must be installed.`,
        };
        writeFileSync(
          readme,
          readFileSync(readme, "utf8").trimEnd() +
            `\n\n## Deploy: ${label}\n\n- \`vite.config.ts\` sets \`rivetRouter({ adapter: "${target}" })\`.\n- ${how[target]}\n`,
        );
        written.push("README.md");
      }
      if (SERVER_ONLY.has(target))
        for (const file of ["serve.js", "Dockerfile", ".dockerignore"])
          if (existsSync(join(dir, file))) {
            rmSync(join(dir, file));
            removed.push(file);
          }
      return { written, removed };
    },
  };
}
