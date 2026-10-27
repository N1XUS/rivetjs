// The MCP server end to end over an in-memory transport, on the real data built from the workspace docs.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildData, dataProblems, type McpData } from "../data.ts";
import { createRivetServer, findDoc } from "../server.ts";
import { tokens } from "../search.ts";

const repo = resolve(import.meta.dirname, "../../..");
let data: McpData;
let client: Client;

const call = async (name: string, args: Record<string, unknown>) => {
  const result = (await client.callTool({ name, arguments: args })) as { content: { type: string; text: string }[]; isError?: boolean };
  return { text: result.content.map((part) => part.text).join("\n"), isError: Boolean(result.isError) };
};

beforeAll(async () => {
  data = await buildData(repo);
  const server = createRivetServer({ data, cwd: repo });
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
}, 120_000);

describe("@rivetjs/mcp", () => {
  it("lists the six tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(["check_code", "explain_diagnostic", "get_component", "get_doc", "list_components", "search_docs"]);
  });
  it("data = the llms outputs of the three sites (same documents), component links resolve", { timeout: 60_000 }, async () => {
    expect(await dataProblems(data, repo)).toEqual([]);
  });
  it("data covers the three sites and a component index", () => {
    for (const site of ["docs", "cdk", "ui"]) expect(data.docs.some((doc) => doc.site === site && doc.kind === "page")).toBe(true);
    expect(data.components.some((component) => component.entry === "@rivetjs/ui/select")).toBe(true);
    expect(data.components.some((component) => component.entry === "@rivetjs/kit/icon")).toBe(true);
    // Links inside the documents are doc ids (`<site>:<path>`), never local origins.
    expect(data.docs.some((doc) => /\]\(http:\/\/127\.0\.0\.1/.test(doc.markdown))).toBe(false);
  });
  it("search_docs finds guides by words and identifiers", async () => {
    const events = await call("search_docs", { query: "event handler inline arrow", site: "docs" });
    expect(events.text).toMatch(/docs:\/[\w/-]+\//);
    const select = await call("search_docs", { query: "Select", site: "ui", limit: 3 });
    expect(select.text).toContain("ui:/components/select/");
    expect(tokens("createAsyncList")).toEqual(expect.arrayContaining(["createasynclist", "async", "list"]));
  });
  it("get_doc reads ids, paths and URLs", async () => {
    const page = await call("get_doc", { path: "ui:/components/select/" });
    expect(page.text.startsWith("# Select\n")).toBe(true);
    expect(page.text).toContain("```tsx title=");
    expect(findDoc(data, "http://127.0.0.1:4327/components/select.md")).toMatchObject({ id: "ui:/components/select/" });
    expect(Array.isArray(findDoc(data, "/components/select/"))).toBe(true);
    expect((await call("get_doc", { path: "ui:/nope/" })).isError).toBe(true);
  });
  it("list_components and get_component", async () => {
    const ui = await call("list_components", { package: "ui" });
    expect(ui.text).toContain("@rivetjs/ui/select");
    const select = await call("get_component", { name: "Select" });
    expect(select.text).toContain('import { Select } from "@rivetjs/ui/select"');
    expect(select.text).toContain("## Examples");
    const cdk = await call("get_component", { name: "Select", package: "cdk" });
    expect(cdk.text).toContain("@rivetjs/cdk/select");
    const icon = await call("get_component", { name: "Icon" });
    expect(icon.text).toContain("@rivetjs/kit/icon");
  });
  it("check_code reports RV codes with fixes, and passes clean code", { timeout: 60_000 }, async () => {
    const bad = await call("check_code", {
      code: 'import { signal } from "@rivetjs/reactivity";\nconst save = () => {};\nexport default function Page() {\n  return <textarea model:value={signal("")}>x</textarea>;\n}\n',
    });
    expect(bad.text).toContain("RV1009");
    expect(bad.text).toContain("fix:");
    expect(bad.text).toContain("quick fix");
    const clean = await call("check_code", {
      code: 'import { signal } from "@rivetjs/reactivity";\nexport default function Page() {\n  const count = signal(0);\n  return <button class="btn" onClick={() => count.update((n) => n + 1)}>{count()}</button>;\n}\n',
    });
    expect(clean.text).toContain("— clean");
    // RV1017 (language-core, type-aware): a signal written from its own read in an effect, with the update rewrite.
    const loop = await call("check_code", {
      code: 'import { effect, signal } from "@rivetjs/reactivity";\nconst x = signal(0);\neffect(() => x.set(x() + 1));\nexport default function Page() {\n  return <p>{x()}</p>;\n}\n',
    });
    expect(loop.text).toContain("RV1017");
    expect(loop.text).toContain("effect(() => x.update((v) => v + 1));");
  });
  it("explain_diagnostic", async () => {
    const one = await call("explain_diagnostic", { code: "rv1016" });
    expect(one.text).toContain("## RV1016:");
    expect(one.text).toContain("Fix: ");
    expect((await call("explain_diagnostic", { code: "all" })).text.split("\n").length).toBeGreaterThan(40);
    expect((await call("explain_diagnostic", { code: "RV0000" })).isError).toBe(true);
  });
});
