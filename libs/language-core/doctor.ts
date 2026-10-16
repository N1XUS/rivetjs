// "Rivet: Doctor": setup problems behind missing or wrong editor features, from facts the host
// collects (tsserver project, TypeScript versions, manifest, generated route types).
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { manifestStatus, viteRoot, type ProjectManifest } from "./manifest.ts";

export interface DoctorInput {
  fileName: string;
  /** Owning tsconfig; undefined for an inferred project (no config includes the file). */
  configFile: string | undefined;
  jsx: string | undefined;
  jsxImportSource: string | undefined;
  /** TypeScript running the language service. */
  tsVersion: string;
  /** Rivet plugin active for this project. */
  pluginLoaded: boolean;
  project: ProjectManifest | null;
}

export interface Finding {
  id: "inferred-project" | "jsx-settings" | "typescript-version" | "plugin" | "manifest" | "route-types";
  severity: "error" | "warning" | "info";
  message: string;
  /** Suggested action (command or file to open). */
  fix?: string;
}

/** Version of the `typescript` package resolvable from `directory` (the workspace TypeScript). */
export function workspaceTypeScriptVersion(directory: string): string | undefined {
  try {
    const require = createRequire(join(directory, "noop.js"));
    return (JSON.parse(readFileSync(require.resolve("typescript/package.json"), "utf8")) as { version: string }).version;
  } catch {
    return undefined;
  }
}

export function doctor(input: DoctorInput): Finding[] {
  const findings: Finding[] = [];
  if (!input.configFile)
    findings.push({
      id: "inferred-project",
      severity: "error",
      message: `${input.fileName} belongs to no tsconfig project; TypeScript uses defaults ("Cannot use JSX unless the '--jsx' flag is provided").`,
      fix: "Add the file to a tsconfig.json include (or rely on the root tsconfig.json catch-all, TypeScript 5.6+).",
    });
  else if (input.jsx !== "preserve" || input.jsxImportSource !== "@rivetjs/runtime")
    findings.push({
      id: "jsx-settings",
      severity: "error",
      message: `${input.configFile} compiles JSX with jsx=${input.jsx ?? "unset"}, jsxImportSource=${input.jsxImportSource ?? "unset"}; Rivet needs "preserve" and "@rivetjs/runtime".`,
      fix: `Extend tsconfig.base.json in ${input.configFile}.`,
    });
  const workspace = workspaceTypeScriptVersion(dirname(input.fileName));
  if (workspace && workspace !== input.tsVersion)
    findings.push({
      id: "typescript-version",
      severity: "warning",
      message: `The editor runs TypeScript ${input.tsVersion}; the workspace pins ${workspace} (diagnostics may differ from tsc).`,
      fix: 'Run "TypeScript: Select TypeScript Version" → "Use Workspace Version".',
    });
  if (!input.pluginLoaded)
    findings.push({
      id: "plugin",
      severity: "warning",
      message: "The Rivet TypeScript plugin is not active for this project (no compiler diagnostics, resume hints or route features).",
      fix: 'Install the Rivet extension, or add { "name": "@rivetjs/typescript-plugin" } to compilerOptions.plugins and use the workspace TypeScript.',
    });
  const app = viteRoot(input.fileName);
  if (app && !input.project)
    findings.push({
      id: "manifest",
      severity: "info",
      message: `No .rivet/editor.json for ${app}: resume-mode checks and route features are off until it is generated.`,
      fix: "Run `rivet sync` (or `vite` / `vite build`) in the app.",
    });
  const stale = input.project ? manifestStatus(input.project.root) : null;
  if (stale?.status === "stale")
    findings.push({
      id: "manifest",
      severity: "warning",
      message: `.rivet/editor.json is stale (${stale.reason} changed after it was written): resume modes and routes may be outdated.`,
      fix: "Run `rivet sync` (or restart `vite`) in the app.",
    });
  const root = input.project?.root;
  if (root && input.project!.manifest.routesDir && !existsSync(join(root, ".rivet", "routes.d.ts")))
    findings.push({ id: "route-types", severity: "info", message: "Route types (.rivet/routes.d.ts) are missing.", fix: "Run `rivet sync` (or `vite` / `vite build`) in the app." });
  return findings;
}
