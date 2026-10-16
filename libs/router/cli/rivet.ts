#!/usr/bin/env node
// Rivet router CLI.
//   rivet sync [--root <dir>] [--config <vite config>] [--mode <mode>]
//     Write the app's generated `.rivet/` files (route types, generated app, editor manifest) from its
//     Vite config without starting Vite. Run before `tsc` / `rivet-check` on a fresh clone.
//   rivet migrate server-exports [--routes src/routes] [--dry-run]
//     Rename old `*.server.ts` export names (load, guard, actions, entries, headers, GET…) to
//     serverLoad, serverGuard, serverActions, serverEntries, serverHeaders, onGet… (scope-aware).
//   rivet mcp
//     Start the Rivet MCP server (`@rivetjs/mcp`, stdio) installed in the app; same as `npx @rivetjs/mcp`.
import { relative } from "node:path";

const USAGE = `usage: rivet sync [--root <dir>] [--config <file>] [--mode <mode>]
       rivet migrate server-exports [--routes <dir>] [--dry-run]
       rivet mcp`;

async function syncCommand(args: string[]): Promise<number> {
  const options: { root?: string; configFile?: string; mode?: string } = {};
  for (let i = 0; i < args.length; i++) {
    const [flag, value] = [args[i], args[i + 1]];
    if (value === undefined || !["--root", "--config", "--mode"].includes(flag!)) {
      console.error(USAGE);
      return 2;
    }
    options[flag === "--root" ? "root" : flag === "--config" ? "configFile" : "mode"] = value;
    i++;
  }
  const { sync } = await import("../build/sync.ts");
  const result = await sync(options);
  const where = relative(process.cwd(), result.root) || ".";
  if (!result.configFile) {
    console.error(`rivet sync: no Vite config in ${where}`);
    return 2;
  }
  if (!result.manifest) {
    console.error(`rivet sync: ${relative(process.cwd(), result.configFile)} uses no Rivet Vite plugin (nothing generated)`);
    return 2;
  }
  const routes = result.manifest.routes?.length ?? 0;
  const resume = result.manifest.resumeModules?.length ?? 0;
  console.log(`rivet sync: ${where}/.rivet (${routes} route${routes === 1 ? "" : "s"}, ${resume} resume module${resume === 1 ? "" : "s"})`);
  return 0;
}

async function migrateCommand(rest: string[]): Promise<number> {
  let routes = "src/routes";
  let dry = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--dry-run") dry = true;
    else if (rest[i] === "--routes" && rest[i + 1]) routes = rest[++i]!;
    else {
      console.error(USAGE);
      return 2;
    }
  }
  const { migrateServerExports, writeMigration } = await import("../build/migrate.ts");
  const cwd = process.cwd();
  const report = await migrateServerExports(cwd, routes);
  for (const line of report.renamed) console.log("renamed " + line);
  for (const line of report.skipped) console.log("skipped " + line);
  if (!dry) await writeMigration(report);
  console.log(`${dry ? "would change" : "changed"} ${report.changes.size} file(s)${report.changes.size ? ": " + [...report.changes.keys()].map((f) => relative(cwd, f)).join(", ") : ""}`);
  return 0;
}

/** `rivet mcp`: run the app's `@rivetjs/mcp` bin with this process's stdio (the MCP protocol). */
async function mcpCommand(): Promise<number> {
  const { createRequire } = await import("node:module");
  const { dirname, join } = await import("node:path");
  const { existsSync } = await import("node:fs");
  const { spawn } = await import("node:child_process");
  let dir: string;
  try {
    dir = dirname(createRequire(join(process.cwd(), "noop.js")).resolve("@rivetjs/mcp"));
  } catch {
    console.error("rivet mcp: @rivetjs/mcp is not installed here; run `npx -y @rivetjs/mcp` or `npm install -D @rivetjs/mcp`");
    return 2;
  }
  const cli = ["cli.js", "cli.ts"].map((name) => join(dir, name)).find((file) => existsSync(file))!;
  const child = spawn(process.execPath, [cli, ...process.argv.slice(3)], { stdio: "inherit" });
  return new Promise((done) => child.on("exit", (code) => done(code ?? 1)));
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command === "sync") return syncCommand(rest);
  if (command === "migrate" && rest[0] === "server-exports") return migrateCommand(rest.slice(1));
  if (command === "mcp") return mcpCommand();
  if (command === "-h" || command === "--help") {
    console.log(USAGE);
    return 0;
  }
  console.error(USAGE);
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
