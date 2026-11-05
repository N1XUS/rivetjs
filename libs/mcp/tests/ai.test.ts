// AI instruction files (libs/mcp/ai): one source → starters + Claude Code plugin, checked in and in sync.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENTS_MAX_BYTES, aiOutputs, aiProblems, readSkills, REPO, staleOutputs, uiSubpaths } from "../ai/sync.ts";

describe("ai sync", () => {
  it("AGENTS.md stays under the Codex project-doc budget, starts with the lookup rules and lists every ui subpath", async () => {
    const outputs = await aiOutputs();
    const agents = outputs.get("templates/starter-ui/AGENTS.md")!;
    expect(Buffer.byteLength(agents)).toBeLessThanOrEqual(AGENTS_MAX_BYTES);
    expect(AGENTS_MAX_BYTES).toBeLessThan(32 * 1024);
    expect(agents).not.toContain("{{ui-components}}");
    // The rules agents need most come first (agents skim; Codex truncates the tail).
    const head = agents.slice(0, 6000);
    for (const text of ["npx -y @rivetjs/mcp component", "https://ui.rivetjs.severyn.pro/llms.txt", "npm run check", "@rivetjs/kit/icon", "React → Rivet"])
      expect(head, text).toContain(text);
    const subpaths = uiSubpaths();
    expect(subpaths).toEqual(expect.arrayContaining(["button", "drawer", "modal", "select", "table", "textfield"]));
    for (const name of subpaths) expect(agents).toContain(`\`${name}\``);
  });
  it("generated files are checked in and current (node libs/mcp/ai/sync.ts)", async () => {
    expect(await aiProblems()).toEqual([]);
  });
  it("every starter has AGENTS.md = CLAUDE.md, Copilot + Cursor rules and every skill", async () => {
    const outputs = await aiOutputs();
    const skills = readSkills();
    expect(skills.map((skill) => skill.id)).toEqual([
      "add-route",
      "add-ui-page",
      "design-ui",
      "fix-resumability-error",
      "form-in-drawer",
      "port-react-component",
    ]);
    for (const starter of ["starter-minimal", "starter-server", "starter-static", "starter-ui"]) {
      const read = (path: string) => readFileSync(join(REPO, "templates", starter, path), "utf8");
      expect(read("AGENTS.md")).toBe(read("CLAUDE.md"));
      expect(read("AGENTS.md")).toContain("# Rivet app: instructions for AI assistants");
      expect(read(".github/copilot-instructions.md")).toContain("AGENTS.md");
      expect(read(".cursor/rules/rivet.mdc")).toMatch(/^---\ndescription: .+\nglobs:\nalwaysApply: true\n---\n/);
      for (const skill of skills) {
        expect(read(`.claude/skills/${skill.name}/SKILL.md`)).toMatch(new RegExp(`^---\\nname: ${skill.name}\\ndescription: `));
        expect(read(`.agents/skills/${skill.name}/SKILL.md`)).toBe(read(`.claude/skills/${skill.name}/SKILL.md`));
        expect(outputs.has(`templates/${starter}/.cursor/rules/${skill.name}.mdc`)).toBe(true);
      }
    }
  });
  it("portable design skill includes its license and every linked reference in public, starter and plugin bundles", async () => {
    const outputs = await aiOutputs();
    const publicRoot = "skills/rivet-ui-design";
    const entry = outputs.get(`${publicRoot}/SKILL.md`);
    expect(entry).toBeDefined();
    const roots = [publicRoot, "libs/mcp/plugin/skills/rivet-ui-design"];
    for (const starter of ["starter-minimal", "starter-server", "starter-static", "starter-ui"])
      for (const agent of [".agents", ".claude"]) roots.push(`templates/${starter}/${agent}/skills/rivet-ui-design`);
    const publicFiles = [...outputs.keys()].filter((path) => path.startsWith(`${publicRoot}/`));
    expect(publicFiles.length).toBeGreaterThan(2);
    for (const root of roots) {
      for (const path of publicFiles) expect(outputs.get(root + path.slice(publicRoot.length)), `${root}: ${path}`).toBe(outputs.get(path));
      expect(outputs.get(`${root}/LICENSE.txt`)).toBe(readFileSync(join(REPO, "LICENSE"), "utf8"));
      for (const path of publicFiles.filter((path) => path.endsWith(".md"))) {
        for (const match of outputs.get(path)!.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
          const target = match[1]!;
          if (/^[a-z]+:/.test(target)) continue;
          expect(outputs.has(posix.normalize(posix.join(posix.dirname(root + path.slice(publicRoot.length)), target))), `${root}: ${target}`).toBe(true);
        }
      }
    }
    for (const starter of ["starter-minimal", "starter-server", "starter-static", "starter-ui"]) {
      const rule = `templates/${starter}/.cursor/rules/rivet-ui-design.mdc`;
      for (const match of outputs.get(rule)!.matchAll(/\]\(([^)#]+)\)/g))
        expect(outputs.has(posix.normalize(posix.join(posix.dirname(rule), match[1]!))), `${rule}: ${match[1]}`).toBe(true);
    }
  });
  it("loads nested skill resources and removes obsolete generated resources without touching unrelated skills", async () => {
    const repo = mkdtempSync(join(tmpdir(), "rivet-ai-"));
    try {
      const source = join(repo, "source");
      mkdirSync(join(source, "example/references/nested"), { recursive: true });
      writeFileSync(join(source, "example.md"), "---\nname: rivet-example\ndescription: Example skill\n---\n\nSee [guide](references/nested/guide.md).\n");
      writeFileSync(join(source, "example/references/nested/guide.md"), "# Guide\n");
      expect(readSkills(source)[0]!.resources).toEqual({ "references/nested/guide.md": "# Guide\n" });
      mkdirSync(join(repo, "templates/starter-test"), { recursive: true });
      writeFileSync(join(repo, "LICENSE"), "Test license\n");
      const expected = await aiOutputs(repo);
      const paths = [
        "templates/starter-test/.agents/skills/rivet-ui-design/references/removed.md",
        "templates/starter-test/.claude/skills/rivet-ui-design/references/removed.md",
        "skills/rivet-ui-design/references/removed.md",
        "skills/rivet-removed/SKILL.md",
        "skills/unrelated/SKILL.md",
        "templates/starter-test/.agents/skills/unrelated/SKILL.md",
      ];
      for (const path of paths) {
        mkdirSync(dirname(join(repo, path)), { recursive: true });
        writeFileSync(join(repo, path), "obsolete\n");
      }
      expect(staleOutputs(expected, repo)).toEqual(paths.slice(0, 4).sort());
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
  it("plugin: manifest, MCP server, skills; marketplace points at it", () => {
    const plugin = JSON.parse(readFileSync(join(REPO, "libs/mcp/plugin/.claude-plugin/plugin.json"), "utf8")) as { name: string };
    expect(plugin.name).toBe("rivet");
    const mcp = JSON.parse(readFileSync(join(REPO, "libs/mcp/plugin/.mcp.json"), "utf8")) as { mcpServers: Record<string, { args: string[] }> };
    expect(mcp.mcpServers.rivet!.args).toContain("@rivetjs/mcp");
    const market = JSON.parse(readFileSync(join(REPO, "libs/mcp/.claude-plugin/marketplace.json"), "utf8")) as { plugins: { source: string }[] };
    expect(market.plugins[0]!.source).toBe("./plugin");
    for (const skill of readSkills())
      expect(readFileSync(join(REPO, `libs/mcp/plugin/skills/${skill.name}/SKILL.md`), "utf8")).toContain(skill.description.slice(0, 40));
  });
  it("instructions name only real MCP tools", async () => {
    const { createRivetServer } = await import("../server.ts");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const server = createRivetServer({ data: { digest: "", origins: { docs: "", cdk: "", ui: "" }, docs: [], components: [] } });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "t", version: "0" });
    await Promise.all([server.connect(a), client.connect(b)]);
    const tools = new Set((await client.listTools()).tools.map((tool) => tool.name));
    const text = [
      readFileSync(join(REPO, "libs/mcp/ai/agents.md"), "utf8"),
      readFileSync(join(REPO, "libs/mcp/ai/digest.md"), "utf8"),
      ...readSkills().map((skill) => skill.body),
    ].join("\n");
    const named = new Set(
      [...text.matchAll(/\b(search_docs|get_doc|get_component|list_components|check_code|explain_diagnostic|[a-z]+_[a-z_]+)\(/g)].map((m) => m[1]!),
    );
    for (const name of named)
      if (/^(search_docs|get_doc|get_component|list_components|check_code|explain_diagnostic)$/.test(name)) expect(tools.has(name)).toBe(true);
    expect(tools.size).toBe(6);
  });
});
