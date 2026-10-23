// Content build: content/**.md → route modules in src/routes/(docs)/ (a path-less group, so a file
// at content/guides/components.md serves /guides/components/), plus nav data, page index and the
// syntax colour stylesheet. Fails on schema errors, unknown references, nav orphans and dangling
// nav entries.
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { splitFrontmatter, validateFrontmatter, type Frontmatter } from "./frontmatter.ts";
import { createHighlight, type Highlight } from "./highlight.ts";
import { attr, renderMarkdown, slugger, text, type Heading } from "./markdown.ts";
import { navChildren, navPath, navPaths, navTag, type NavArea, type NavSection } from "../nav.ts";
import { generateErrorPages } from "../errors.ts";
import { loadApp } from "../app.ts";
import type { BenchChartSpec } from "../../components/chart-model.ts";
import type { ApiCardData } from "../../components/ApiCard.tsx";
import { RUNS_ON } from "../../api-labels.ts";
import type { ApiModel, ApiSymbol } from "../api.ts";

/** The `::api` card's data (first declaration of a merged symbol wins, like `symbolByKey`). */
const apiCard = (s: ApiSymbol): ApiCardData => ({
  name: s.name,
  kind: s.kind,
  entry: s.entry,
  href: s.href,
  summary: s.summary,
  ...(s.signatures[0] ? { signature: s.signatures[0] } : {}),
  runs: RUNS_ON[s.runsOn],
});

/** Generated route directory (path-less group), relative to the app root. */
export const ROUTES_DIR = "src/routes/(docs)";
export const GENERATED_DIR = "src/generated";
const GLOSSARY = "reference/glossary";

export interface PageMeta {
  path: string;
  href: string;
  title: string;
  description: string;
  status: Frontmatter["status"];
  template: Frontmatter["template"];
  section: string;
  sectionTitle: string;
  group: string;
  tags: string[];
}
export interface ContentResult {
  pages: PageMeta[];
  /** Files written (relative to the app root) — changed ones only. */
  written: string[];
  /** Pages that still contain the TODO-CONTENT placeholder. */
  todo: string[];
  /** Hard-coded localhost / 127.0.0.1 links in content (`<page>: <url>`); `check-content --strict` fails on them. */
  localLinks: string[];
}

const posixPath = (path: string) => path.split("\\").join("/");
const hrefOf = (path: string) => "/" + path.replace(/(^|\/)index$/, "") + (path === "index" ? "" : "/");

async function listMarkdown(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_"))
    .map((entry) => posixPath(relative(dir, join(entry.parentPath, entry.name))).replace(/\.md$/, ""))
    .sort();
}
async function listDirs(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  return (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith(".")).map((e) => e.name);
}

/** Glossary terms: each `## Term` heading and the paragraph after it. */
export function glossaryTerms(body: string): Map<string, { title: string; definition: string }> {
  const terms = new Map<string, { title: string; definition: string }>();
  const slug = slugger();
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const heading = /^##\s+(.+?)\s*$/.exec(lines[i]!);
    if (!heading) continue;
    const title = heading[1]!.replace(/`/g, "");
    let j = i + 1;
    while (j < lines.length && !lines[j]!.trim()) j++;
    const paragraph: string[] = [];
    while (j < lines.length && lines[j]!.trim() && !lines[j]!.startsWith("#")) paragraph.push(lines[j++]!.trim());
    const definition = paragraph
      .join(" ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "");
    terms.set(slug(title), { title, definition });
  }
  return terms;
}

/** Write `contents` when it differs; returns whether it changed. */
async function put(file: string, contents: string): Promise<boolean> {
  const current = await readFile(file, "utf8").catch(() => null);
  if (current === contents) return false;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, contents);
  return true;
}

let shared: Promise<Highlight> | undefined;

/** Generate every content route for the app at `root`. */
export async function generateContent(
  root: string,
  options: {
    symbols?: ReadonlyMap<string, ApiCardData>;
    dryRun?: boolean;
    /**
     * Dev server: content problems that only concern one page (nav entry without its file, page missing
     * from the nav, unknown link / API symbol / example, a page that fails to render) are reported here
     * instead of thrown — a page being written must not take the whole docs dev server down. Builds and
     * `check-content` stay strict (no `lenient`).
     */
    lenient?: (message: string) => void;
  } = {},
): Promise<ContentResult> {
  const lenient = options.lenient;
  const { site, templates, repo } = await loadApp(root);
  const write = options.dryRun ? async () => false : put;
  const contentDir = resolve(root, "content");
  // Diagnostic code pages (site `errorPages`): committed Markdown under content/errors/, refreshed before the pages are read.
  if (site.errorPages && !options.dryRun) await generateErrorPages(root);
  const navModule = (await import(pathToFileURL(resolve(contentDir, "_nav.ts")).href + "?t=" + Date.now())) as { nav: NavSection[]; areas?: NavArea[] };
  const nav = navModule.nav;
  const areas = navModule.areas;
  if (!Array.isArray(areas) || !areas.length) throw new Error("content/_nav.ts: export const areas: NavArea[] (the top-bar sections) is required");
  for (const section of nav)
    if (!areas.some((area) => area.id === section.area))
      throw new Error(`content/_nav.ts: section "${section.id}" has area "${section.area}", which is not in areas (${areas.map((a) => a.id).join(", ")})`);
  for (const area of areas)
    if (!area.href && !nav.some((section) => section.area === area.id)) throw new Error(`content/_nav.ts: area "${area.id}" has no section`);

  const chartsFile = resolve(contentDir, "_charts.ts");
  const charts = existsSync(chartsFile)
    ? new Map(Object.entries(((await import(pathToFileURL(chartsFile).href + "?t=" + Date.now())) as { charts: Record<string, BenchChartSpec> }).charts))
    : undefined;
  const files = await listMarkdown(contentDir);
  const examples = new Set((await listDirs(resolve(root, "examples"))).filter((id) => existsSync(resolve(root, "examples", id, "example.ts"))));
  const starters = new Set(await listDirs(templates));
  let symbols = options.symbols;
  if (!symbols && existsSync(resolve(root, GENERATED_DIR, "api.json"))) {
    const api = JSON.parse(await readFile(resolve(root, GENERATED_DIR, "api.json"), "utf8")) as ApiModel;
    symbols = new Map(api.symbols.map((s) => [s.key, apiCard(s)]));
  }

  // Nav ↔ files.
  const order: { path: string; section: NavSection; group: string }[] = [];
  const seen = new Set<string>();
  for (const section of nav)
    for (const group of section.groups)
      for (const path of group.pages.flatMap(navPaths)) {
        if (seen.has(path)) throw new Error(`content/_nav.ts: ${path} is listed twice`);
        seen.add(path);
        if (!files.includes(path)) {
          const message = `content/_nav.ts: ${path} has no file (content/${path}.md)`;
          if (!lenient) throw new Error(message);
          lenient(message + " — skipped");
          continue;
        }
        order.push({ path, section, group: group.title });
      }
  const orphans = files.filter((file) => !seen.has(file));
  if (orphans.length) {
    const message = `Pages missing from content/_nav.ts: ${orphans.join(", ")}`;
    if (!lenient) throw new Error(message);
    lenient(message + " — not routed");
  }

  const highlight = await (shared ??= createHighlight());
  const sources = new Map<string, { fm: Frontmatter; body: string; bodyLine: number }>();
  for (const { path } of order) {
    const source = await readFile(resolve(contentDir, path + ".md"), "utf8");
    const { raw, body, bodyLine } = splitFrontmatter(source, `content/${path}.md`);
    sources.set(path, { fm: validateFrontmatter(raw, `content/${path}.md`), body, bodyLine });
  }
  const terms = sources.has(GLOSSARY) ? glossaryTerms(sources.get(GLOSSARY)!.body) : new Map();

  const pages: PageMeta[] = order.map(({ path, section, group }) => {
    const { fm } = sources.get(path)!;
    return {
      path,
      href: hrefOf(path),
      title: fm.title,
      description: fm.description,
      status: fm.status,
      template: fm.template,
      section: section.id,
      sectionTitle: section.title,
      group,
      tags: fm.tags,
    };
  });
  const byPath = new Map(pages.map((page) => [page.path, page]));
  const written: string[] = [];
  const outRoutes = resolve(root, ROUTES_DIR);
  const expected = new Set<string>();
  const localLinks: string[] = [];
  const internalLinks: { from: string; href: string }[] = [];

  for (const [index, page] of pages.entries()) {
    const { fm, body, bodyLine } = sources.get(page.path)!;
    const context = {
      path: page.path,
      ...(site.sites ? { sites: site.sites } : {}),
      highlight,
      terms,
      examples,
      starters,
      ...(symbols ? { symbols } : {}),
      ...(charts ? { charts } : {}),
    };
    let rendered: ReturnType<typeof renderMarkdown>;
    try {
      rendered = renderMarkdown(body, context, bodyLine - 1);
    } catch (error) {
      if (!lenient) throw error;
      const message = String((error as Error)?.message ?? error);
      lenient(message + " — page shows the error");
      rendered = renderMarkdown("Docs dev: this page failed to render.\n\n```text\n" + message.replaceAll("```", "'''") + "\n```\n", context, 0);
    }
    for (const href of rendered.links) internalLinks.push({ from: page.path, href });
    for (const url of rendered.localLinks) localLinks.push(`${page.path}: ${url}`);
    for (const related of fm.related)
      if (!byPath.has(related)) {
        const message = `content/${page.path}.md: related page "${related}" does not exist`;
        if (!lenient) throw new Error(message);
        lenient(message);
      }
    const file = resolve(outRoutes, page.path + ".tsx");
    expected.add(file);
    const components = "@rivetjs/docs-kit/components";
    const imports = [`import { DocPage } from "${components}/DocPage.tsx";`];
    if (rendered.uses.has("CopyButton")) imports.push(`import { CopyButton } from "${components}/CodeBlock.tsx";`);
    if (rendered.examples.size)
      imports.push(
        `import { Example } from "${components}/Example.tsx";`,
        `import { load, type PageProps } from "@rivetjs/router";`,
        `import { examples } from "virtual:docs/examples";`,
      );
    if (rendered.uses.has("ApiCard")) imports.push(`import { ApiCard } from "${components}/ApiCard.tsx";`);
    if (rendered.uses.has("BenchChart")) imports.push(`import { BenchChart } from "${components}/BenchChart.tsx";`);
    if (rendered.uses.has("StarterButton")) imports.push(`import { StarterButton } from "${components}/StarterButton.tsx";`);
    if (rendered.icons.size) imports.push(`import { Icon } from "@rivetjs/kit/icon";`, `import { ${[...rendered.icons].sort().join(", ")} } from "lucide";`);
    const link = (p: PageMeta | undefined) => (p ? { title: p.title, href: p.href } : undefined);
    const prev = link(pages[index - 1]);
    const next = link(pages[index + 1]);
    const toc = rendered.headings.filter((h): h is Heading & { depth: 2 | 3 } => h.depth <= 3).map(({ depth, id, text }) => ({ depth, id, text }));
    const props = {
      path: page.href,
      title: fm.title,
      description: fm.description,
      status: fm.status,
      template: fm.template,
      section: page.section,
      source: `${posixPath(relative(repo, root))}/content/${page.path}.md`,
      toc,
      related: fm.related.flatMap((r) => (byPath.has(r) ? [link(byPath.get(r))!] : [])),
      ...(prev ? { prev } : {}),
      ...(next ? { next } : {}),
      ...(fm.spec ? { spec: fm.spec } : {}),
      ...(fm.since ? { since: fm.since } : {}),
    };
    const head = {
      title: `${fm.title} · ${site.name}`,
      meta: [
        { name: "description", content: fm.description },
        { property: "og:title", content: fm.title },
        { property: "og:description", content: fm.description },
        { property: "og:type", content: "article" },
      ],
      links: [{ rel: "canonical", href: site.origin + page.href }],
    };
    const tsx = [
      `// Generated from ${posixPath(relative(repo, root))}/content/${page.path}.md by @rivetjs/docs-kit. Do not edit.`,
      ...imports,
      "",
      `export const head = ${JSON.stringify(head)};`,
      "",
      // The browser adopts and client-renders pages too. Keep the full manifest on the server, and send only the
      // examples this page embeds through the route payload (the client manifest is deliberately empty).
      ...(rendered.examples.size
        ? [
            `export const loader = load(() => ({ examples: { ${[...rendered.examples].map((id) => `${JSON.stringify(id)}: examples[${JSON.stringify(id)}]`).join(", ")} } }));`,
            "",
            `export default function Page({ data }: PageProps<typeof loader>) {`,
          ]
        : [`export default function Page() {`]),
      `  return (`,
      `    <DocPage page={${JSON.stringify(props)}}>`,
      rendered.jsx
        .split("\n")
        .map((line) => "      " + line)
        .join("\n"),
      `    </DocPage>`,
      `  );`,
      `}`,
      "",
    ].join("\n");
    if (await write(file, tsx)) written.push(posixPath(relative(root, file)));
  }

  // Fragments: `content/_<name>.md` (no frontmatter, not pages) → `src/generated/fragments/<name>.tsx`, a
  // component wide pages (the home route) import to render Markdown blocks (code fences, compiled
  // output) through this pipeline.
  const fragmentsDir = resolve(root, GENERATED_DIR, "fragments");
  const fragmentFiles = new Set<string>();
  const fragmentNames = (await readdir(contentDir)).filter((file) => /^_[a-z0-9-]+\.md$/.test(file)).sort();
  // Fragments are coloured at build time (same tokens / classes as the browser highlighter): the home page they serve
  // is a lean page (site `leanPages`), which runs no highlighter before the first interaction.
  const tokens = fragmentNames.length
    ? await (await import("../../components/highlighter.ts")).loadTokenizer(["tsx", "ts", "js", "json", "bash", "css", "html"])
    : undefined;
  for (const name of fragmentNames) {
    const id = name.slice(1, -3);
    const from = `content/${name}`;
    const rendered = renderMarkdown(await readFile(resolve(contentDir, name), "utf8"), {
      path: "_" + id,
      ...(site.sites ? { sites: site.sites } : {}),
      highlight,
      ...(tokens ? { tokens } : {}),
      terms,
      examples,
      starters,
      ...(symbols ? { symbols } : {}),
    });
    for (const href of rendered.links) internalLinks.push({ from: "_" + id, href });
    for (const url of rendered.localLinks) localLinks.push(`_${id}: ${url}`);
    const kit = {
      CopyButton: "CodeBlock.tsx",
      Example: "Example.tsx",
      ApiCard: "ApiCard.tsx",
      StarterButton: "StarterButton.tsx",
      BenchChart: "BenchChart.tsx",
    } as Record<string, string>;
    const imports = [...rendered.uses].sort().map((use) => `import { ${use} } from "@rivetjs/docs-kit/components/${kit[use]}";`);
    if (rendered.examples.size) imports.push(`import type { ExampleData } from "@rivetjs/docs-kit/components/types.ts";`);
    if (rendered.icons.size) imports.push(`import { Icon } from "@rivetjs/kit/icon";`, `import { ${[...rendered.icons].sort().join(", ")} } from "lucide";`);
    const file = resolve(fragmentsDir, id + ".tsx");
    fragmentFiles.add(file);
    const tsx = [
      `// Generated from ${posixPath(relative(repo, root))}/${from} by @rivetjs/docs-kit. Do not edit.`,
      ...imports,
      "",
      `/** Markdown fragment \`${from}\`. */`,
      rendered.examples.size
        ? `export default function Fragment({ data }: { data: { examples: Record<string, ExampleData> } }) {`
        : `export default function Fragment() {`,
      `  return (`,
      `    <>`,
      rendered.jsx
        .split("\n")
        .map((line) => "      " + line)
        .join("\n"),
      `    </>`,
      `  );`,
      `}`,
      "",
    ].join("\n");
    if (await write(file, tsx)) written.push(posixPath(relative(root, file)));
  }
  if (!options.dryRun && existsSync(fragmentsDir))
    for (const entry of await readdir(fragmentsDir))
      if (!fragmentFiles.has(resolve(fragmentsDir, entry))) {
        await rm(resolve(fragmentsDir, entry));
        written.push(posixPath(relative(root, resolve(fragmentsDir, entry))));
      }

  // Internal links must point at a page or a known site route.
  const known = new Set([...pages.map((p) => p.href), ...areas.flatMap((area) => (area.href ? [area.href] : [])), "/", "/examples/", "/api/", "/search/"]);
  for (const { from, href } of internalLinks) {
    const path = href.split("#")[0]!;
    if (!path) continue;
    if (known.has(path) || path.startsWith("/api/") || path.startsWith("/examples/")) continue;
    const message = `content/${from}.md: link to unknown page ${href}`;
    if (!lenient) throw new Error(message);
    lenient(message);
  }

  // Site routes shared by every docs site (search, examples, API reference), copied from the kit to
  // the same paths under src/routes/ (route ids `search`, `examples/[id]`, `api/[...symbol]`, …).
  const kitRoutes = fileURLToPath(new URL("../../routes/", import.meta.url));
  for (const entry of await readdir(kitRoutes, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const source = resolve(entry.parentPath, entry.name);
    const file = resolve(root, "src/routes", relative(kitRoutes, source));
    const tsx = `// Copied from @rivetjs/docs-kit/routes/${posixPath(relative(kitRoutes, source))}. Do not edit.\n` + (await readFile(source, "utf8"));
    if (await write(file, tsx)) written.push(posixPath(relative(root, file)));
  }

  // Remove generated routes whose source is gone.
  if (!options.dryRun && existsSync(outRoutes))
    for (const entry of await readdir(outRoutes, { recursive: true, withFileTypes: true }))
      if (entry.isFile() && !expected.has(resolve(entry.parentPath, entry.name))) {
        await rm(resolve(entry.parentPath, entry.name));
        written.push(posixPath(relative(root, resolve(entry.parentPath, entry.name))));
      }

  const sections = nav.map((section) => ({
    id: section.id,
    title: section.title,
    area: section.area,
    // `lenient` skips nav entries without a file: only pages that exist.
    href: byPath.get(section.groups.flatMap((group) => group.pages.map(navPath)).find((path) => byPath.has(path)) ?? "")?.href ?? "/",
    groups: section.groups.map((group) => ({
      title: group.title,
      items: group.pages.flatMap((entry) => {
        const page = byPath.get(navPath(entry));
        if (!page) return [];
        const tag = navTag(entry);
        const children = navChildren(entry).flatMap((path) => (byPath.has(path) ? [byPath.get(path)!.href] : []));
        return [{ href: page.href, title: page.title, status: page.status, ...(tag ? { tag } : {}), ...(children.length ? { children } : {}) }];
      }),
    })),
  }));
  const areaData = areas.map((area) => ({ id: area.id, title: area.title, href: area.href ?? sections.find((section) => section.area === area.id)!.href }));
  const generated = resolve(root, GENERATED_DIR);
  const navTs = [
    "// Generated by @rivetjs/docs-kit from content/_nav.ts. Do not edit.",
    'import type { NavAreas, NavData } from "@rivetjs/docs-kit/components/types.ts";',
    "",
    `export const areas: NavAreas = ${JSON.stringify(areaData, null, 2)};`,
    "",
    `export const sections: NavData = ${JSON.stringify(sections, null, 2)};`,
    "",
  ].join("\n");
  if (await write(resolve(generated, "nav.ts"), navTs)) written.push(GENERATED_DIR + "/nav.ts");
  const pagesTs = [
    "// Generated by @rivetjs/docs-kit. Do not edit.",
    'import type { PageIndexEntry } from "@rivetjs/docs-kit/components/types.ts";',
    "",
    `export const pages: PageIndexEntry[] = ${JSON.stringify(
      pages.map(({ href, title, description, status, section, sectionTitle, group, tags, template }) => ({
        href,
        title,
        description,
        status,
        section,
        sectionTitle,
        group,
        tags,
        template,
      })),
      null,
      2,
    )};`,
    "",
  ].join("\n");
  if (await write(resolve(generated, "pages.ts"), pagesTs)) written.push(GENERATED_DIR + "/pages.ts");
  const terms_ = [...terms].map(([id, t]) => ({ id, ...t }));
  if (await write(resolve(generated, "terms.json"), JSON.stringify(terms_, null, 2) + "\n")) written.push(GENERATED_DIR + "/terms.json");
  if (await write(resolve(generated, "highlight.css"), highlight.css())) written.push(GENERATED_DIR + "/highlight.css");
  // Starter templates as StackBlitz payloads (`::starter`, home "Try in browser").
  const starterData: Record<string, Record<string, string>> = {};
  for (const name of [...starters].sort()) {
    const dir = resolve(templates, name);
    const files: Record<string, string> = {};
    for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const file = posixPath(relative(dir, join(entry.parentPath, entry.name)));
      if (/(^|\/)(node_modules|dist|\.rivet)(\/|$)/.test(file)) continue;
      // AI instruction files (libs/mcp/ai/sync.ts): ≈ 70 KB per starter, not useful in a StackBlitz sandbox.
      if (/^(AGENTS\.md|CLAUDE\.md|\.claude\/|\.cursor\/|\.github\/copilot-instructions\.md)/.test(file)) continue;
      let contents = await readFile(join(entry.parentPath, entry.name), "utf8");
      if (file === "package.json") {
        const pkg = JSON.parse(contents) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
        for (const deps of [pkg.dependencies ?? {}, pkg.devDependencies ?? {}])
          for (const dep of Object.keys(deps)) if (dep.startsWith("@rivetjs/")) deps[dep] = site.packageVersion;
        contents = JSON.stringify(pkg, null, 2) + "\n";
      }
      files[file] = contents;
    }
    starterData[name] = files;
  }
  const startersTs = [
    "// Generated by @rivetjs/docs-kit from templates/. Do not edit.",
    "",
    `export const starters: Record<string, Record<string, string>> = ${JSON.stringify(starterData)};`,
    "",
  ].join("\n");
  if (await write(resolve(generated, "starters.ts"), startersTs)) written.push(GENERATED_DIR + "/starters.ts");
  const todo = [...sources].filter(([, { fm, body }]) => (fm.description + body).includes("TODO-CONTENT")).map(([path]) => path);
  return { pages, written, todo, localLinks };
}

export { attr, text };
export const contentPathOf = (file: string, root: string): string | undefined => {
  const rel = posix.normalize(posixPath(relative(resolve(root, "content"), file)));
  return rel.startsWith("..") || !rel.endsWith(".md") ? undefined : rel.replace(/\.md$/, "");
};
