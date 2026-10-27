#!/usr/bin/env node
// Node-only Rivet commands. MCP stdout is reserved for its protocol.
import { relative, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { debugEnabled, paint, progress, suggestion, summary } from "@rivetjs/compiler/format";

export const USAGE = `Usage:
  rivet <command> [options]

Commands:
  sync                     Generate .rivet route types and editor manifest
  migrate server-exports   Rewrite legacy route server exports
  mcp                      Start the installed @rivetjs/mcp stdio server

Options:
  --root <dir>             App root for sync (default: current directory)
  --config <file>          Vite config for sync (relative to root)
  --mode <mode>            Vite mode for sync (default: production)
  --routes <dir>           Routes directory for migrate (default: src/routes)
  --dry-run                Preview migration without writing files
  --quiet                  Errors only (sync / migrate)
  --json                   One JSON result (sync / migrate)
  --verbose                Include error stacks (also DEBUG=rivet)
  -h, --help               Show help

Examples:
  rivet sync --root ./my-app
  rivet sync --json
  rivet migrate server-exports --dry-run
  rivet mcp

Exit status: 0 success, 1 failure, 2 usage error.`;

class UsageError extends Error {}
const commonFlags = ["--quiet", "--json", "--verbose", "--help"];
function unknown(value: string, choices: readonly string[]): never {
  throw new UsageError(`Unknown argument ${value}.${suggestion(value, choices)} Run rivet --help.`);
}
function valueOf(args: string[], i: number): string {
  const value = args[i + 1];
  if (!value || value.startsWith("-")) throw new UsageError(`${args[i]} requires a value. Run rivet --help.`);
  return value;
}

/** `rivet mcp`: inherit stdio without adding presentation to the protocol. */
async function mcpCommand(args: string[]): Promise<number> {
  const { createRequire } = await import("node:module");
  const { dirname, join } = await import("node:path");
  const { existsSync } = await import("node:fs");
  const { spawn } = await import("node:child_process");
  let dir: string;
  try {
    dir = dirname(createRequire(join(process.cwd(), "noop.js")).resolve("@rivetjs/mcp"));
  } catch {
    throw new Error("@rivetjs/mcp is not installed here. Run npm install -D @rivetjs/mcp, then rivet mcp.");
  }
  const cli = ["cli.js", "cli.ts"].map((name) => join(dir, name)).find(existsSync);
  if (!cli) throw new Error(`@rivetjs/mcp has no CLI in ${dir}. Reinstall @rivetjs/mcp.`);
  const child = spawn(process.execPath, [cli, ...args], { stdio: "inherit" });
  return new Promise((done, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => done(code ?? 1));
  });
}

export async function main(argv: string[]): Promise<number> {
  const commandIndex = argv.findIndex((arg) => !commonFlags.includes(arg));
  const json = argv.includes("--json") && argv[commandIndex] !== "mcp";
  const quiet = argv.includes("--quiet");
  const verbose = argv.includes("--verbose") || debugEnabled();
  let task: ReturnType<typeof progress> | undefined;
  const started = performance.now();
  try {
    if (argv.includes("--help") || argv.includes("-h")) {
      console.log(USAGE);
      return 0;
    }
    const [command, ...rest] = argv.filter((arg) => !["--json", "--quiet", "--verbose"].includes(arg));
    if (command === "mcp") return await mcpCommand(argv.slice(commandIndex + 1));
    if (command !== "sync" && command !== "migrate") unknown(command ?? "(missing command)", ["sync", "migrate", "mcp"]);
    if (command === "sync") {
      const options: { root?: string; configFile?: string; mode?: string } = {};
      for (let i = 0; i < rest.length; i++) {
        const flag = rest[i]!;
        if (!["--root", "--config", "--mode"].includes(flag)) unknown(flag, ["--root", "--config", "--mode", ...commonFlags]);
        options[flag === "--root" ? "root" : flag === "--config" ? "configFile" : "mode"] = valueOf(rest, i++);
      }
      const logs: { severity: string; message: string; count: number }[] = [];
      const { sync } = await import("../build/sync.ts");
      task = progress("rivet sync: generating routes and editor manifest", { quiet: quiet || json });
      const result = await sync({
        ...options,
        onLog(severity, message) {
          const existing = logs.find((entry) => entry.severity === severity && entry.message === message);
          if (existing) existing.count++;
          else logs.push({ severity, message, count: 1 });
        },
      });
      const where = relative(process.cwd(), result.root) || ".";
      if (!result.configFile) throw new Error(`no Vite config in ${where}. Run from an app directory or pass --root / --config.`);
      if (!result.manifest)
        throw new Error(
          `${relative(process.cwd(), result.configFile)} uses no Rivet Vite plugin (nothing generated). Add rivetRouter() or rivet() to plugins.`,
        );
      const routes = result.manifest.routes?.length ?? 0;
      const resume = result.manifest.resumeModules?.length ?? 0;
      const errors = logs.filter((entry) => entry.severity === "error").reduce((n, entry) => n + entry.count, 0);
      const warnings = logs.filter((entry) => entry.severity === "warning").reduce((n, entry) => n + entry.count, 0);
      task.stop(`rivet sync: generated ${routes} routes`);
      if (json)
        console.log(
          JSON.stringify({
            command,
            root: result.root,
            routes,
            resumeModules: resume,
            errors,
            warnings,
            diagnostics: logs,
            durationMs: Math.round(performance.now() - started),
          }),
        );
      else {
        for (const entry of logs)
          if (!quiet || entry.severity === "error")
            console.error(`${entry.severity}: ${entry.message}${entry.count > 1 ? ` (${entry.count} occurrences)` : ""}`);
        if (!quiet) {
          console.log(`rivet sync: ${where}/.rivet (${routes} route${routes === 1 ? "" : "s"}, ${resume} resume module${resume === 1 ? "" : "s"})`);
          console.log(summary(errors, warnings));
        }
      }
      return errors ? 1 : 0;
    }
    const migration = rest.shift();
    if (migration !== "server-exports") unknown(migration ?? "(migration)", ["server-exports"]);
    let routes = "src/routes",
      dry = false;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--dry-run") dry = true;
      else if (rest[i] === "--routes") routes = valueOf(rest, i++);
      else unknown(rest[i]!, ["--routes", "--dry-run", ...commonFlags]);
    }
    const cwd = process.cwd();
    if (!(await stat(resolve(cwd, routes))).isDirectory()) throw new Error(`${routes} is not a directory. Pass --routes <directory>.`);
    const { migrateServerExports, writeMigration } = await import("../build/migrate.ts");
    task = progress("rivet migrate: scanning " + routes, { quiet: quiet || json });
    const report = await migrateServerExports(cwd, routes);
    if (!dry) await writeMigration(report);
    task.stop(`rivet migrate: ${dry ? "would change" : "changed"} ${report.changes.size} files`);
    const skipped = [...new Set(report.skipped)];
    if (json)
      console.log(
        JSON.stringify({
          command: "migrate",
          dryRun: dry,
          changed: [...report.changes.keys()].map((f) => relative(cwd, f)),
          renamed: report.renamed,
          skipped,
          errors: 0,
          warnings: report.skipped.length,
        }),
      );
    else if (!quiet) {
      for (const line of report.renamed) console.log("renamed " + line);
      for (const line of skipped)
        console.error(`warning: skipped ${line}\n  fix: Update this export manually; use rivet migrate server-exports --dry-run to review.`);
      console.log(`${dry ? "would change" : "changed"} ${report.changes.size} file(s)`);
      console.log(summary(0, report.skipped.length));
    }
    return 0;
  } catch (error) {
    task?.stop();
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof UsageError ? 2 : 1;
    const fix = code === 2 ? "Run rivet --help for usage." : "Check the named file/configuration and retry; use --verbose for details.";
    if (json) console.log(JSON.stringify({ error: message, fix, exitCode: code, ...(verbose && error instanceof Error ? { stack: error.stack } : {}) }));
    else console.error(`${paint("red", "error:")} ${message}\n  fix: ${fix}${verbose && error instanceof Error ? "\n" + error.stack : ""}`);
    return code;
  } finally {
    task?.stop();
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
