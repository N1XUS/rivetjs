// Read-only view of one docs site for the AI outputs (llms.txt, per-page Markdown, @rivetjs/mcp data): pages in nav
// order with their Markdown bodies, the committed API model, example sources, glossary, charts. Reads only committed
// sources (content/, examples/, src/generated/api.json): nothing is generated or written, so the outputs are a pure
// function of the repository.
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import type { BenchChartSpec } from "../../components/chart-model.ts";
import type { ApiModel } from "../api.ts";
import { loadApp, type DocsSite } from "../app.ts";
import { exampleIds, loadExample, shownFile } from "../examples.ts";
import { splitFrontmatter, validateFrontmatter, type Frontmatter } from "../content/frontmatter.ts";
import { glossaryTerms } from "../content/generate.ts";
import { navPaths, type NavArea, type NavSection } from "../nav.ts";

export interface LlmsPage {
  /** Content path (`guides/components`; `index` = home). */
  path: string;
  /** Page URL path (`/guides/components/`). */
  href: string;
  title: string;
  description: string;
  status: Frontmatter["status"];
  template: Frontmatter["template"];
  tags: string[];
  area: string;
  areaTitle: string;
  section: string;
  sectionTitle: string;
  group: string;
  /** Markdown body (frontmatter removed). */
  body: string;
  /** Repository path of the source (`apps/docs/content/guides/components.md`). */
  source: string;
}

export interface LlmsExample {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  /** Shown files (example.ts `show`), plain text (region markers and line notation stripped). */
  files: { path: string; text: string }[];
  /** Pages embedding it (`::example{id}`), by content path. */
  usedOn: string[];
}

export interface LlmsSource {
  root: string;
  /** Repository-relative app root (`apps/docs`). */
  app: string;
  site: DocsSite;
  areas: NavArea[];
  pages: LlmsPage[];
  api: ApiModel;
  examples: Map<string, LlmsExample>;
  terms: Map<string, { title: string; definition: string }>;
  charts: Map<string, BenchChartSpec>;
}

const posix = (path: string) => path.split(sep).join("/");
export const hrefOf = (path: string): string => "/" + path.replace(/(^|\/)index$/, "") + (path === "index" ? "" : "/");

/** Load the site at `root` for the AI outputs. Throws on the same nav / frontmatter errors as the content build. */
export async function loadLlmsSource(root: string): Promise<LlmsSource> {
  const { site, repo } = await loadApp(root);
  root = resolve(root);
  const contentDir = resolve(root, "content");
  const navModule = (await import(pathToFileURL(resolve(contentDir, "_nav.ts")).href)) as { nav: NavSection[]; areas?: NavArea[] };
  const areas = navModule.areas ?? [];
  const pages: LlmsPage[] = [];
  for (const section of navModule.nav) {
    const area = areas.find((candidate) => candidate.id === section.area);
    for (const group of section.groups)
      for (const path of group.pages.flatMap(navPaths)) {
        const file = resolve(contentDir, path + ".md");
        const text = await readFile(file, "utf8");
        const { raw, body } = splitFrontmatter(text, `content/${path}.md`);
        const fm = validateFrontmatter(raw, `content/${path}.md`);
        pages.push({
          path,
          href: hrefOf(path),
          title: fm.title,
          description: fm.description,
          status: fm.status,
          template: fm.template,
          tags: fm.tags,
          area: section.area,
          areaTitle: area?.title ?? section.area,
          section: section.id,
          sectionTitle: section.title,
          group: group.title,
          body,
          source: posix(relative(repo, file)),
        });
      }
  }
  const glossary = pages.find((page) => page.path === "reference/glossary");
  const terms = glossary ? glossaryTerms(glossary.body) : new Map<string, { title: string; definition: string }>();
  const apiFile = resolve(root, "src/generated/api.json");
  const api: ApiModel = existsSync(apiFile) ? (JSON.parse(await readFile(apiFile, "utf8")) as ApiModel) : { entries: [], symbols: [] };
  const chartsFile = resolve(contentDir, "_charts.ts");
  const charts = existsSync(chartsFile)
    ? new Map(Object.entries(((await import(pathToFileURL(chartsFile).href)) as { charts: Record<string, BenchChartSpec> }).charts))
    : new Map<string, BenchChartSpec>();
  const usedOn = new Map<string, string[]>();
  for (const page of pages)
    for (const match of page.body.matchAll(/::example\{[^}]*\bid="?([\w-]+)"?/g)) {
      const list = usedOn.get(match[1]!) ?? [];
      if (!list.includes(page.path)) list.push(page.path);
      usedOn.set(match[1]!, list);
    }
  const examples = new Map<string, LlmsExample>();
  for (const id of await exampleIds(root)) {
    const config = await loadExample(root, id);
    const dir = resolve(root, "examples", id);
    const files: LlmsExample["files"] = [];
    for (const path of config.show) {
      const source = await readFile(resolve(dir, path), "utf8");
      files.push({ path, text: shownFile(path, source).text });
    }
    examples.set(id, { id, title: config.title, summary: config.summary, tags: config.tags ?? [], files, usedOn: usedOn.get(id) ?? [] });
  }
  return { root, app: posix(relative(repo, root)), site, areas, pages, api, examples, terms, charts };
}

/** Fence language of a shown file. */
export function fenceLang(path: string): string {
  const ext = extname(path).slice(1);
  return ext === "mjs" || ext === "cjs" ? "js" : ext || "text";
}

/** Files under `dir` (posix, relative), sorted; for tests and the MCP data builder. */
export async function listTree(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => posix(relative(dir, join(entry.parentPath, entry.name))))
    .sort();
}
