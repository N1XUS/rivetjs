// `rivet-mcp <command>`: one tool call from a shell (agents without an MCP client), same text as the MCP tools.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLI = resolve(import.meta.dirname, "../cli.ts");
const STARTER = resolve(import.meta.dirname, "../../../templates/starter-ui");
const run = (args: string[], cwd = STARTER) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", timeout: 120_000 });

describe("rivet-mcp CLI commands", () => {
  it("--help lists the commands; an unknown command exits 2", () => {
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    for (const command of ["search", "doc", "components", "component", "check", "explain"]) expect(help.stdout).toContain(`  ${command} `);
    const unknown = run(["nope"]);
    expect(unknown.status).toBe(2);
    expect(unknown.stderr).toMatch(/unknown command "nope"/);
  });

  it("explain prints the diagnostic explanation; an unknown code exits 1", () => {
    const ok = run(["explain", "RV2001"]);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toMatch(/RV2001/);
    expect(ok.stdout).toMatch(/clientEffect/);
    expect(run(["explain", "RV0000"]).status).toBe(1);
  });

  it("component and search answer from the docs data", { timeout: 120_000 }, () => {
    const component = run(["component", "Drawer", "--examples", "0"]);
    expect(component.status).toBe(0);
    expect(component.stdout).toContain('import { Drawer } from "@rivetjs/ui/drawer";');
    const search = run(["search", "form", "in", "drawer", "--limit", "3"]);
    expect(search.status).toBe(0);
    expect(search.stdout).toMatch(/docs:\/guides\/forms\/forms-in-overlays\//);
  });

  it("check exits 1 on an RV error and prints the fix", () => {
    const dir = mkdtempSync(join(tmpdir(), "rivet-mcp-cli-"));
    try {
      writeFileSync(join(dir, "bad.tsx"), "export default function A() {\n  return <button onclick={() => 1}>x</button>;\n}\n");
      writeFileSync(join(dir, "good.tsx"), "export default function A() {\n  return <p>x</p>;\n}\n");
      const bad = run(["check", "bad.tsx"], dir);
      expect(bad.status).toBe(1);
      expect(bad.stdout).toMatch(/RV1012/);
      expect(bad.stdout).toMatch(/fix:/);
      expect(run(["check", "good.tsx"], dir).status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
