// Provider readiness is completed inference, never a cached model entry or the agent's claim about code.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { codex, checkModel, codexIsolationArgs } from "./agent.ts";
import { execute, restrictedEnvironment, type ProcessResult } from "./process.ts";
import { acquireLock, safeFile } from "./workspace.ts";
import type { Agent } from "./types.ts";

export interface CliCapabilities {
  version: string;
  mcpServers: string[];
}
/** Inspect configuration privately: raw MCP JSON can contain credential-bearing environment/transport fields. */
export function inspectCodex(cwd: string, deadline = Date.now() + 30000): CliCapabilities {
  const inspect = (args: string[]): string => {
    if (Date.now() >= deadline) throw new Error("Provider inspection timeout");
    const result = spawnSync("nice", ["-n", "10", "codex", ...args], {
      cwd,
      env: restrictedEnvironment(),
      encoding: "utf8",
      timeout: Math.max(1, Math.min(10000, deadline - Date.now())),
      maxBuffer: 1024 * 1024,
    });
    if (result.error || result.status !== 0) throw new Error("Codex CLI configuration inspection failed; check the installed CLI locally");
    return result.stdout;
  };
  const version = inspect(["--version"]).trim();
  if (!/^codex-cli [^\r\n]{1,128}$/.test(version)) throw new Error("Invalid Codex CLI version response");
  const list = (args: string[]): { name: string; enabled: boolean }[] => {
    let value: unknown;
    try {
      value = JSON.parse(inspect([...args, "mcp", "list", "--json"]));
    } catch {
      throw new Error("Invalid private Codex MCP metadata; response omitted");
    }
    if (!Array.isArray(value) || value.length > 256 || value.some((row) => !row || typeof row.name !== "string" || typeof row.enabled !== "boolean"))
      throw new Error("Invalid private Codex MCP metadata; response omitted");
    return value.map((row) => ({ name: row.name, enabled: row.enabled }));
  };
  const mcpServers = list(["--disable", "apps", "--disable", "plugins"]).map((row) => row.name);
  const scoped = codexIsolationArgs(mcpServers);
  if (list(scoped).some((row) => row.enabled)) throw new Error("Configured MCP integration could not be disabled for the harness");
  return { version, mcpServers };
}
export function providerFailure(log: string, reason: string | null): { kind: string; message: string } {
  if (reason) return { kind: reason === "memory-limit" ? "resource-limit" : reason, message: `Provider process stopped: ${reason}` };
  if (/model_not_found|model[^\n]{0,100}not supported/i.test(log))
    return { kind: "unsupported-model", message: "The configured model is unavailable for this CLI login; use an explicit compatible --model override." };
  if (/\b401\b|not logged in|authentication|unauthorized/i.test(log))
    return { kind: "authentication", message: "Codex CLI authentication failed; check the existing CLI login." };
  if (/\b429\b|rate.limit|quota.exceeded/i.test(log))
    return { kind: "rate-limit", message: "The provider rejected this request due to its current usage limit." };
  if (/ECONNREFUSED|ENOTFOUND|connection|network|TLS|timed.out/i.test(log))
    return { kind: "network", message: "The CLI could not complete its provider connection." };
  return { kind: "provider-error", message: "The provider process failed; inspect its retained local log." };
}
export interface DoctorResult {
  id: string;
  status: "ready" | "failed" | "interrupted";
  model: string | null;
  cliVersion: string | null;
  disabledMcpServers: string[];
  startedAt: string;
  finishedAt?: string;
  execution?: ProcessResult;
  failure?: { kind: string; message: string };
}
interface DoctorOptions {
  root: string;
  model?: string;
  signal?: AbortSignal;
  wallMs?: number;
  rssLimitMB?: number;
  /** Scripted external boundary for deterministic tests only. */
  agent?: Agent;
  capabilities?: CliCapabilities;
}
export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  if (options.model !== undefined) checkModel(options.model);
  const wall = options.wallMs ?? 60000,
    rss = options.rssLimitMB ?? 3072;
  if (!Number.isFinite(wall) || wall <= 0 || wall > 60000 || !Number.isFinite(rss) || rss <= 0 || rss > 3072 || (options.capabilities && !options.agent))
    throw new Error("Invalid doctor budget or fixture override");
  const parent = join(resolve(options.root), ".artifacts/ai-tester");
  const release = acquireLock(parent);
  const id = new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID().slice(0, 8);
  const dir = join(parent, "diagnostics", id);
  let workspace: string | undefined;
  const result: DoctorResult = {
    id,
    status: "failed",
    model: options.model ?? null,
    cliVersion: null,
    disabledMcpServers: [],
    startedAt: new Date().toISOString(),
  };
  const deadline = Date.now() + wall;
  try {
    mkdirSync(dir, { recursive: true });
    workspace = mkdtempSync(join(tmpdir(), "rivet-ai-doctor-"));
    if (options.signal?.aborted) throw new Error("interrupted");
    const capabilities = options.capabilities ?? inspectCodex(workspace, deadline);
    result.cliVersion = capabilities.version;
    result.disabledMcpServers = capabilities.mcpServers;
    const schema = join(dir, "provider.schema.json"),
      output = join(dir, "provider.json"),
      log = join(dir, "provider.log");
    writeFileSync(schema, JSON.stringify({ type: "object", additionalProperties: false, properties: { ready: { type: "boolean" } }, required: ["ready"] }));
    const command = (options.agent ?? codex)({
      role: "reviewer",
      workspace,
      output,
      schema,
      model: options.model,
      mcpServers: capabilities.mcpServers,
      prompt:
        'Provider readiness probe only. Do not inspect files, call tools, edit, review code, or contact services. Return exactly {"ready":true} matching the schema.',
    });
    const args = options.agent ? command.args : [...command.args.slice(0, -1), "--skip-git-repo-check", "-"];
    result.execution = await execute({ ...command, args, cwd: workspace, log, deadline, rssLimitMB: rss, signal: options.signal });
    const transcript = readFileSync(log, "utf8");
    if (result.execution.reason || result.execution.code !== 0) result.failure = providerFailure(transcript, result.execution.reason);
    else {
      let value: unknown;
      try {
        value = JSON.parse(readFileSync(safeFile(dir, "provider.json"), "utf8"));
      } catch {}
      const turns = transcript.split("\n").flatMap((line) => {
        try {
          const event = JSON.parse(line);
          return /^turn\.(completed|failed)$/.test(event.type) ? [event.type] : [];
        } catch {
          return [];
        }
      });
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).join() !== "ready" ||
        (value as { ready?: unknown }).ready !== true ||
        turns.at(-1) !== "turn.completed"
      )
        result.failure = { kind: "invalid-result", message: "Provider did not complete a turn with the exact readiness result." };
      else result.status = "ready";
    }
  } catch (error) {
    result.failure = {
      kind: options.signal?.aborted ? "interrupted" : Date.now() >= deadline ? "timeout" : "setup",
      message: error instanceof Error ? error.message : "Provider setup failed",
    };
  } finally {
    if (options.signal?.aborted) result.status = "interrupted";
    result.finishedAt = new Date().toISOString();
    try {
      writeFileSync(join(dir, "doctor.json"), JSON.stringify(result, null, 2) + "\n");
    } finally {
      if (workspace) rmSync(workspace, { recursive: true, force: true });
      release();
    }
  }
  return result;
}
