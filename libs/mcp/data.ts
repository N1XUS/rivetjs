// The server's knowledge: every docs page, API entry and example of the three docs sites (the same documents as their
// llms.txt outputs, `@rivetjs/docs-kit/tools/llms`), plus a component index (ui, cdk, kit entry points with their API
// symbols, docs page and examples). `buildData(repo)` derives it from the committed sources; the package ships it as
// `data/rivet.json` (`bundle.ts`); in the workspace it is built in memory on first use (`loadData`).
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Docs sites by key (the `site:<key>/…` names of the docs content). */
export const SITES = { docs: "apps/docs", cdk: "apps/cdk-docs", ui: "apps/ui-docs" } as const;
export type SiteKey = keyof typeof SITES;

export interface McpDoc {
  /** `<site>:<href>` (`ui:/components/select/`): what `get_doc` takes and links in `markdown` use. */
  id: string;
  site: SiteKey;
  kind: "page" | "api" | "example";
  href: string;
  title: string;
  description: string;
  section: string;
  tags: string[];
  markdown: string;
}

export interface McpSymbol {
  name: string;
  kind: string;
  summary: string;
  signatures: string[];
  members: { name: string; signature: string; optional: boolean; default?: string; doc: string }[];
}

export interface McpComponent {
  /** Display name (`Select`, `ComboBox`, `Icon`). */
  name: string;
  package: "ui" | "cdk" | "kit";
  /** Import specifier (`@rivetjs/ui/select`). */
  entry: string;
  summary: string;
  /** Docs page id (`ui:/components/select/`), when one documents the entry. */
  doc?: string;
  /** API entry doc id. */
  api: string;
  symbols: McpSymbol[];
  /** Example doc ids (`ui:/examples/select-default/`) shown on the docs page. */
  examples: string[];
}

export interface McpData {
  /** sha256 of the documents (sources digest): equal data ⇔ equal digest. */
  digest: string;
  /** Site origins the data was built with (docs URLs `get_doc` accepts). */
  origins: Record<SiteKey, string>;
  docs: McpDoc[];
  components: McpComponent[];
}

const posix = (path: string) => path.replaceAll("\\", "/");

/** Build the data from the docs sites under `repo` (needs the workspace: `@rivetjs/docs-kit`). */
export async function buildData(repo: string): Promise<McpData> {
  // Workspace-only tool (devDependency): loaded by path so the published server never imports it.
  const llms = (await import(
    pathToFileURL(resolve(repo, "libs/docs-kit/tools/llms/generate.ts")).href
  )) as typeof import("@rivetjs/docs-kit/tools/llms/generate.ts");
  const sourceModule = (await import(
    pathToFileURL(resolve(repo, "libs/docs-kit/tools/llms/source.ts")).href
  )) as typeof import("@rivetjs/docs-kit/tools/llms/source.ts");
  const docs: McpDoc[] = [];
  const components = new Map<string, McpComponent>();
  // Sibling-site links in content resolve to these origins (site configs read env vars; defaults are local ports).
  const origins: Record<string, SiteKey> = {};
  const sources = [];
  for (const [site, app] of Object.entries(SITES) as [SiteKey, string][]) {
    const source = await sourceModule.loadLlmsSource(resolve(repo, app));
    origins[source.site.origin.replace(/\/+$/, "")] = site;
    sources.push({ site, source });
  }
  for (const { site, source } of sources) {
    const output = llms.llmsFrom(source, {
      link: (target) => {
        if (target.kind === "external") {
          for (const [origin, key] of Object.entries(origins)) if (target.href.startsWith(origin + "/")) return `${key}:${target.href.slice(origin.length)}`;
          return target.href;
        }
        return `${site}:${target.href}`;
      },
    });
    for (const doc of output.docs)
      docs.push({
        id: `${site}:${doc.href}`,
        site,
        kind: doc.kind,
        href: doc.href,
        title: doc.title,
        description: doc.description,
        section: doc.section,
        tags: doc.tags,
        markdown: doc.markdown.replace(/^Source: \S+ \([^)]*\)\n\n/m, `Doc: ${site}:${doc.href}\n\n`),
      });
    for (const entry of source.api.entries) {
      const pkg = /^@rivetjs\/(ui|cdk|kit)(\/|$)/.exec(entry.entry)?.[1] as McpComponent["package"] | undefined;
      if (!pkg || components.has(entry.entry)) continue;
      const symbols = source.api.symbols.filter((symbol) => symbol.entry === entry.entry);
      const last = entry.entry.split("/").at(-1)!;
      const pascal = last.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
      const main = symbols.find((symbol) => symbol.name.toLowerCase() === pascal.toLowerCase()) ?? symbols.find((symbol) => /^[A-Z]/.test(symbol.name));
      // The docs page that documents the entry: a page importing it, components/<last> first.
      const importing = (body: string) => body.includes(`from "${entry.entry}"`);
      const candidates = sources.flatMap(({ site: key, source: s }) => s.pages.filter((page) => importing(page.body)).map((page) => ({ key, page })));
      const page =
        candidates.find(({ key, page }) => key === pkg && page.path.endsWith(`/${last}`)) ??
        candidates.find(({ page }) => page.path.endsWith(`/${last}`)) ??
        candidates.find(({ key }) => key === pkg);
      const examples = page
        ? [...page.page.body.matchAll(/::example\{[^}]*\bid="?([\w-]+)"?/g)]
            .map((match) => `${page.key}:/examples/${match[1]}/`)
            .filter((id, i, all) => all.indexOf(id) === i)
        : [];
      components.set(entry.entry, {
        name: main?.name ?? pascal,
        package: pkg,
        entry: entry.entry,
        summary: entry.summary,
        ...(page ? { doc: `${page.key}:${page.page.href}` } : {}),
        api: `${site}:${entry.href}`,
        symbols: symbols.map((symbol) => ({
          name: symbol.name,
          kind: symbol.kind,
          summary: symbol.summary,
          signatures: symbol.signatures,
          members: symbol.members.map((member) => ({
            name: member.name,
            signature: member.signature,
            optional: member.optional,
            ...(member.default ? { default: member.default } : {}),
            doc: member.doc,
          })),
        })),
        examples,
      });
    }
  }
  const list = [...components.values()].sort((a, b) => a.entry.localeCompare(b.entry));
  const hash = createHash("sha256");
  for (const doc of docs) hash.update(doc.id + "\0" + doc.markdown + "\0");
  hash.update(JSON.stringify(list));
  const siteOrigins = Object.fromEntries(Object.entries(origins).map(([origin, key]) => [key, origin])) as Record<SiteKey, string>;
  return { digest: hash.digest("hex"), origins: siteOrigins, docs, components: list };
}

/** Where the data lives next to the server module. */
export const dataFile = (dir = import.meta.dirname): string => join(dir, "data", "rivet.json");

/** Write `data` as JSON (one line: the file is read whole). */
export async function writeData(data: McpData, file = dataFile()): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data) + "\n");
}

/** The workspace root when this module runs from the repository (source package), else undefined. */
export function workspaceRoot(dir = import.meta.dirname): string | undefined {
  const repo = resolve(dir, "../..");
  return existsSync(resolve(repo, "libs/docs-kit/tools/llms/generate.ts")) && posix(dir).endsWith("/libs/mcp") ? repo : undefined;
}

/** The data holds exactly the docs of every site's llms output, and the component index points at existing docs. */
export async function dataProblems(data: McpData, repo: string): Promise<string[]> {
  const problems: string[] = [];
  const llms = (await import(
    pathToFileURL(resolve(repo, "libs/docs-kit/tools/llms/generate.ts")).href
  )) as typeof import("@rivetjs/docs-kit/tools/llms/generate.ts");
  const ids = new Set(data.docs.map((doc) => doc.id));
  let expected = 0;
  for (const [site, app] of Object.entries(SITES)) {
    const output = await llms.generateLlms(resolve(repo, app));
    expected += output.docs.length;
    for (const doc of output.docs) if (!ids.has(`${site}:${doc.href}`)) problems.push(`missing ${site}:${doc.href} (in ${app} llms output)`);
  }
  if (expected !== data.docs.length) problems.push(`${data.docs.length} docs, llms outputs have ${expected}`);
  for (const component of data.components) {
    for (const id of [component.api, ...(component.doc ? [component.doc] : []), ...component.examples])
      if (!ids.has(id)) problems.push(`component ${component.entry}: unknown doc ${id}`);
  }
  return problems;
}

let loaded: Promise<McpData> | undefined;

/**
 * The server's data. Published package: the bundled `data/rivet.json`. Workspace (source package): built from the
 * docs sources in memory once per process (a few seconds), so it is never stale against the docs. `file` forces a file.
 */
export function loadData(options: { file?: string } = {}): Promise<McpData> {
  if (loaded && !options.file) return loaded;
  const run = (async () => {
    const repo = workspaceRoot();
    if (!options.file && repo) return buildData(repo);
    const file = options.file ?? dataFile();
    if (!existsSync(file)) throw new Error(`@rivetjs/mcp: no data at ${file} (the package is built with bundle.ts)`);
    return JSON.parse(await readFile(file, "utf8")) as McpData;
  })();
  if (!options.file) loaded = run;
  return run;
}
