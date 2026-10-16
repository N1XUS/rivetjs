// The Rivet MCP server: tools over the docs data (`data.ts`), the search index (`search.ts`), the compiler checks
// (`check.ts`) and the diagnostic explanations (`@rivetjs/language-core` `explainCode`). Transport-agnostic:
// `cli.ts` connects it to stdio, tests to an in-memory transport.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { explainCode, explainedCodes, explanationMarkdown } from "@rivetjs/language-core";
import { checkCode, formatCheck } from "./check.ts";
import { loadData, SITES, type McpComponent, type McpData, type McpDoc, type SiteKey } from "./data.ts";
import { createSearchIndex, type SearchIndex } from "./search.ts";

export const SERVER_NAME = "rivet";
export const SERVER_VERSION = "0.0.0-experimental";

const INSTRUCTIONS = `Rivet: compiled, resumable JSX framework (not React, not Solid). Before writing Rivet code, search the docs (search_docs) and read the page (get_doc); for @rivetjs/ui / @rivetjs/cdk / @rivetjs/kit components use get_component (props, parts, import path, example source). After writing a .tsx file, run check_code on it and fix every RV diagnostic (explain_diagnostic gives the mechanical fix). Key rules: class not className; event handlers are inline arrows or local consts; signals are read by calling them (count()) and written with .set / .update; components run once; overlay / closed-provider content that must resume is a render function ({() => …}); icons via <Icon icon={X} /> from @rivetjs/kit/icon with lucide icons, never inline SVG paths or Unicode glyphs.`;

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });
const SITE = z.enum(Object.keys(SITES) as [SiteKey, ...SiteKey[]]);

/** Resolve a `get_doc` path: `ui:/components/select/`, `/components/select/`, `components/select.md`, a full URL. */
export function findDoc(data: McpData, path: string): McpDoc | McpDoc[] | undefined {
  const raw = path.trim();
  const sited = /^(docs|cdk|ui):(.*)$/.exec(raw);
  const url = /^(https?:\/\/[^/]+)(.*)$/.exec(raw);
  const site = (sited?.[1] ?? (url && (Object.entries(data.origins ?? {}) as [SiteKey, string][]).find(([, origin]) => origin === url[1])?.[0])) as
    SiteKey | undefined;
  let rest = sited ? sited[2]! : url ? url[2]! : raw;
  rest = rest
    .split("#")[0]!
    .replace(/\.md$/, "")
    .replace(/(^|\/)index$/, "");
  const href = "/" + rest.replace(/^\/+|\/+$/g, "") + (rest.replace(/^\/+|\/+$/g, "") ? "/" : "");
  const matches = data.docs.filter((doc) => doc.href === href && (!site || doc.site === site));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return matches;
  return undefined;
}

/** Find a component by name (`Select`, `select`, `ui/select`, `@rivetjs/ui/select`), optionally in one package. */
export function findComponents(data: McpData, name: string, pkg?: McpComponent["package"]): McpComponent[] {
  const query = name.trim().replace(/^<|\/?>$/g, "");
  const lower = query.toLowerCase();
  const pool = data.components.filter((component) => !pkg || component.package === pkg);
  const exact = pool.filter(
    (component) =>
      component.entry === query ||
      component.entry.toLowerCase() === "@rivetjs/" + lower ||
      component.name.toLowerCase() === lower.split(".")[0] ||
      component.entry.split("/").at(-1) === lower.replace(/[A-Z]/g, (c, i) => (i ? "-" : "") + c.toLowerCase()),
  );
  if (exact.length) return exact.sort((a, b) => order(a) - order(b));
  return pool.filter((component) => component.symbols.some((symbol) => symbol.name.toLowerCase() === lower)).sort((a, b) => order(a) - order(b));
}
const order = (component: McpComponent) => ({ ui: 0, kit: 1, cdk: 2 })[component.package];

/** Markdown of one component: import, summary, docs page, symbols (props tables), example sources. */
export function componentMarkdown(data: McpData, component: McpComponent, options: { examples?: number } = {}): string {
  const out = [`# ${component.name} (${component.entry})`, "", `\`import { ${component.name} } from "${component.entry}";\``, ""];
  if (component.summary) out.push(component.summary, "");
  out.push(`Docs: ${component.doc ? `get_doc("${component.doc}")` : "no guide page"} · API: get_doc("${component.api}")`, "");
  for (const symbol of component.symbols) {
    out.push(`## ${symbol.name} (${symbol.kind})`);
    if (symbol.summary) out.push("", symbol.summary);
    if (symbol.signatures.length) out.push("", "```ts", ...symbol.signatures, "```");
    if (symbol.members.length) {
      out.push("", "| Prop / member | Signature | Default | Description |", "| --- | --- | --- | --- |");
      for (const member of symbol.members)
        out.push(
          `| ${member.name}${member.optional ? "?" : ""} | \`${member.signature.replace(/\s+/g, " ").replace(/\|/g, "\\|")}\` | ${member.default ? "`" + member.default + "`" : ""} | ${member.doc.replace(/\s+/g, " ").replace(/\|/g, "\\|")} |`,
        );
    }
    out.push("");
  }
  const limit = options.examples ?? 3;
  const examples = component.examples.map((id) => data.docs.find((doc) => doc.id === id)).filter((doc): doc is McpDoc => Boolean(doc));
  if (examples.length) {
    out.push(`## Examples (${Math.min(limit, examples.length)} of ${examples.length}; get_doc an id for more)`, "");
    for (const doc of examples.slice(0, limit)) out.push(doc.markdown.replace(/^# /, "### ").replace(/^Doc: .*\n\n/m, `Doc: ${doc.id}\n\n`), "");
    if (examples.length > limit)
      out.push(
        "More: " +
          examples
            .slice(limit)
            .map((doc) => doc.id)
            .join(", "),
        "",
      );
  }
  return out.join("\n");
}

export interface RivetServerOptions {
  /** Data to serve (default `loadData()`: bundled file, or built from the workspace docs). */
  data?: McpData | Promise<McpData>;
  /** Working directory for `check_code` (the user's app: its compiler and packages). */
  cwd?: string;
}

/** A configured MCP server (not connected). */
export function createRivetServer(options: RivetServerOptions = {}): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: INSTRUCTIONS });
  let data: Promise<McpData> | undefined;
  let index: Promise<SearchIndex> | undefined;
  const getData = () => (data ??= Promise.resolve(options.data ?? loadData()));
  const getIndex = () => (index ??= getData().then((d) => createSearchIndex(d.docs)));

  server.registerTool(
    "search_docs",
    {
      title: "Search the Rivet docs",
      description:
        "Offline full-text search over the Rivet docs (docs = framework guides + API, cdk = headless components, ui = styled components), API reference entries and example sources. Returns doc ids for get_doc.",
      inputSchema: {
        query: z.string().min(1).describe("Words or identifiers, e.g. 'form in drawer live page' or 'createAsyncList'"),
        site: SITE.optional().describe("docs (framework), cdk (headless components) or ui (styled components)"),
        kind: z.enum(["page", "api", "example"]).optional().describe("Only guide pages, API entries or examples"),
        limit: z.number().int().min(1).max(50).optional().describe("Default 10"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, site, kind, limit }) => {
      const hits = (await getIndex()).search(query, { ...(site ? { site } : {}), ...(kind ? { kind } : {}), limit: limit ?? 10 });
      if (!hits.length) return text(`No results for "${query}". Try fewer or other words, or list_components.`);
      return text(
        hits.map((hit, i) => `${i + 1}. ${hit.title} — ${hit.id} (${hit.kind})\n   ${hit.description}${hit.snippet ? `\n   > ${hit.snippet}` : ""}`).join("\n"),
      );
    },
  );

  server.registerTool(
    "get_doc",
    {
      title: "Read a Rivet docs page",
      description:
        "Full Markdown of one docs page, API entry or example: a doc id from search_docs (`ui:/components/select/`), a page path (`/guides/components/events/`) or a docs URL (also its `.md` form).",
      inputSchema: { path: z.string().min(1).describe("Doc id, path or URL") },
      annotations: { readOnlyHint: true },
    },
    async ({ path }) => {
      const found = findDoc(await getData(), path);
      if (!found) return { ...text(`No doc at "${path}". Use search_docs to find the id.`), isError: true };
      if (Array.isArray(found)) return text(`"${path}" exists on several sites; pass one id:\n${found.map((doc) => `- ${doc.id}: ${doc.title}`).join("\n")}`);
      return text(found.markdown);
    },
  );

  server.registerTool(
    "list_components",
    {
      title: "List Rivet components",
      description:
        "Component entry points of @rivetjs/ui (styled compound components), @rivetjs/cdk (headless, React Aria / Angular CDK port) and @rivetjs/kit (head, icons, transitions…).",
      inputSchema: { package: z.enum(["ui", "cdk", "kit"]).optional().describe("Only one package") },
      annotations: { readOnlyHint: true },
    },
    async ({ package: pkg }) => {
      const list = (await getData()).components.filter((component) => !pkg || component.package === pkg);
      return text(list.map((component) => `- ${component.name} — ${component.entry}${component.summary ? `: ${component.summary}` : ""}`).join("\n"));
    },
  );

  server.registerTool(
    "get_component",
    {
      title: "Rivet component reference",
      description:
        "Import path, props / parts (API symbols with members), docs page and example source code of a @rivetjs/ui, @rivetjs/cdk or @rivetjs/kit component. Name like `Select`, `ComboBox`, `Icon`, or an entry `@rivetjs/cdk/select`. ui is preferred when both packages have the name; pass package to choose.",
      inputSchema: {
        name: z.string().min(1),
        package: z.enum(["ui", "cdk", "kit"]).optional(),
        examples: z.number().int().min(0).max(20).optional().describe("Example sources to include (default 3)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ name, package: pkg, examples }) => {
      const d = await getData();
      const found = findComponents(d, name, pkg);
      if (!found.length) return { ...text(`No component "${name}"${pkg ? ` in ${pkg}` : ""}. Use list_components or search_docs.`), isError: true };
      const [first, ...others] = found;
      const also = others.length ? `\n\nAlso: ${others.map((component) => component.entry).join(", ")} (pass package or the entry).` : "";
      return text(componentMarkdown(d, first!, { examples: examples ?? 3 }) + also);
    },
  );

  server.registerTool(
    "check_code",
    {
      title: "Check Rivet code",
      description:
        "Compile a .tsx/.ts snippet with the Rivet compiler (server + browser targets, resumable by default) and the Rivet language service: RV diagnostics with line, mechanical fix text and quick fixes (with the fixed source), plus TypeScript errors when @rivetjs packages resolve from the server's working directory. Run it on every Rivet file you write.",
      inputSchema: {
        code: z.string().describe("Whole file source"),
        filename: z.string().optional().describe("App-relative path, default src/routes/index.tsx (route files get route checks)"),
        resume: z.boolean().optional().describe("Compile as a resumable module (default true for .tsx/.jsx, as in the starters)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ code, filename, resume }) => {
      const result = checkCode(code, {
        ...(filename ? { filename } : {}),
        ...(resume !== undefined ? { resume } : {}),
        ...(options.cwd ? { cwd: options.cwd } : {}),
      });
      return text(formatCheck(result));
    },
  );

  server.registerTool(
    "explain_diagnostic",
    {
      title: "Explain a Rivet diagnostic",
      description:
        "Meaning, emitted messages, mechanical fix, quick fix and an Avoid / Prefer pair of a Rivet diagnostic code (RV1016, 1016). `all` lists every code.",
      inputSchema: { code: z.string().min(1).describe("RV code, or `all`") },
      annotations: { readOnlyHint: true },
    },
    async ({ code }) => {
      if (code.trim().toLowerCase() === "all")
        return text(
          explainedCodes()
            .map((e) => `- ${e.code} (${e.severity}${e.retired ? ", retired" : ""}): ${e.title} — ${e.fix}`)
            .join("\n"),
        );
      const explanation = explainCode(code);
      if (!explanation) return { ...text(`Unknown diagnostic code "${code}". Codes look like RV1016; explain_diagnostic("all") lists them.`), isError: true };
      return text(explanationMarkdown(explanation));
    },
  );
  return server;
}
