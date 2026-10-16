// Test app (written under .artifacts/, inside the repo so workspace packages resolve) and an
// in-process language service with the plugin applied, as tsserver would.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import init, { type PluginConfig } from "../index.ts";

export const repo = fileURLToPath(new URL("../../../", import.meta.url));

/** Position right after `/*name*\/` in `text`. */
export const at = (text: string, name: string): number => {
  const marker = `/*${name}*/`;
  const index = text.indexOf(marker);
  if (index === -1) throw new Error(`marker ${marker} missing`);
  return index + marker.length;
};

export const sources = {
  "src/counter.tsx": `import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
class Store { #items: string[] = []; get items() { return this.#items; } }
declare function makeStore(): Store;
export function Counter({ step }: { step: number }) {
  const /*count*/count = signal(0);
  const store = makeStore();
  clientEffect(() => { void store.items; });
  return <button /*on*/onClick={/*closure*/() => count.set(count() + step)}>{/*use*/count()}</button>;
}
`,
  "src/broken.tsx": `export const Broken = (p: string[]) => (
  <div>
    <i>{...p}</i>
    <span preload="idel" onClick={() => 1}>x</span>
    <br>text</br>
  </div>
);
`,
  "src/plain.tsx": `export function Plain() { const w = window.innerWidth; return <p>{w}</p>; }\n`,
  "src/link.tsx": `export function Link(props: { to: string; children?: unknown }) { return <a href={props.to}>{props.children as string}</a>; }\n`,
  "src/typed-link.tsx": `export function Link(props: { to: "/" | \`/items/\${string}\` }) { return <a href={props.to}>x</a>; }\n`,
  "src/links.tsx": `import { Link } from "./link.tsx";
import { Link as Typed } from "./typed-link.tsx";
export const Nav = () => (
  <nav>
    <Link to="/items/1">a</Link>
    <Link to=/*bad*/"/nope">b</Link>
    <Link to=/*complete*/"" />
    <Link to="https://example.com">c</Link>
    <Typed to="/items/2" />
  </nav>
);
`,
};

export interface Fixture {
  root: string;
  file(path: string): string;
  service: ts.LanguageService;
  plugin: ts.server.PluginModule;
  project: ts.server.Project;
  /** Replace a file's text (new script version). */
  edit(path: string, text: string): void;
}

export function fixture(config: PluginConfig = { linkModules: ["./link.tsx", "./typed-link.tsx"] }, projectOverrides: Record<string, unknown> = {}): Fixture {
  mkdirSync(join(repo, ".artifacts"), { recursive: true });
  const root = mkdtempSync(join(repo, ".artifacts", "ts-plugin-"));
  const files: Record<string, string> = {
    ...sources,
    "tsconfig.json": JSON.stringify({ extends: relative(root, join(repo, "tsconfig.base.json")), include: ["src"] }),
    ".rivet/editor.json": JSON.stringify({
      version: 1,
      resumeModules: ["src/counter.tsx"],
      routesDir: "src/routes",
      routes: [
        { id: "items/[id]", pattern: "/items/:id", file: "src/routes/items/[id].tsx" },
        { id: "about", pattern: "/about", file: "src/routes/about.tsx" },
        { id: "index", pattern: "/", file: "src/routes/index.tsx" },
      ],
    }),
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const parsed = ts.getParsedCommandLineOfConfigFile(join(root, "tsconfig.json"), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} })!;
  const overrides = new Map<string, { text: string; version: number }>();
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => parsed.options,
    getScriptFileNames: () => parsed.fileNames,
    getScriptVersion: (file) => String(overrides.get(file)?.version ?? 0),
    getScriptSnapshot: (file) => {
      const text = overrides.get(file)?.text ?? ts.sys.readFile(file);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => root,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
  };
  const languageService = ts.createLanguageService(host);
  const plugin = init({ typescript: ts });
  const project = {
    getCompilerOptions: () => parsed.options,
    getCurrentDirectory: () => root,
    getProjectName: () => join(root, "tsconfig.json"),
    projectKind: ts.server.ProjectKind.Configured,
    getRootFiles: () => parsed.fileNames,
    isClosed: () => false,
    refreshDiagnostics() {},
    projectService: { logger: { info() {} } },
    ...projectOverrides,
  } as unknown as ts.server.Project;
  const service = plugin.create({ languageService, project, config, languageServiceHost: host, serverHost: ts.sys } as unknown as ts.server.PluginCreateInfo);
  return {
    root,
    file: (path) => join(root, path),
    service,
    plugin,
    project,
    edit(path, text) {
      const file = join(root, path);
      overrides.set(file, { text, version: (overrides.get(file)?.version ?? 0) + 1 });
    },
  };
}
