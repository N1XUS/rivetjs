import type { Area, Finding } from "./types.ts";
export const AREAS: Record<Area, { projects: string[]; roots: string[]; brief: string }> = {
  reactivity: {
    projects: ["reactivity", "reactivity-dev"],
    roots: ["libs/reactivity/", "docs/guides/stores.md"],
    brief:
      "Explore typed store produce/reconcile, nested updates, computed/batch diamonds, owner disposal and reference-model operation sequences. StorePath does not include array length; do not use type escapes. Sparse trailing holes shared with Solid and documented Async adoption behavior are not new supported regressions.",
  },
  router: {
    projects: ["router"],
    roots: ["libs/router/", "examples/operations/", "docs/guides/routing.md", "docs/guides/server-code.md"],
    brief:
      "Explore loader/action/guard order, request isolation, kept-layout data requests, escaping and serialization using production operations fixtures. Raw page handlers precede layout guards by contract; onRequest is the shared auth boundary. Tenant/session/checkout policy in operations belongs to the fixture, not Rivet.",
  },
  resume: {
    projects: ["runtime", "runtime-dev", "compiler", "examples"],
    roots: ["libs/runtime/", "libs/compiler/", "examples/operations/", "docs/guides/resumability.md"],
    brief:
      "Explore cold first input, keyed DOM identity, delayed chunk delivery, user input retention, disposal and stream ownership in production builds. Preserve the derived-only model; do not add warm-up or timing sleeps to hide failures. No Rust edits/builds.",
  },
};
export function checkScope(area: Area, finding: Finding, changed: string[]) {
  if (JSON.stringify([...finding.changedPaths].sort()) !== JSON.stringify(changed))
    throw new Error("Model changed-path manifest does not match snapshot changes");
  for (const path of changed) {
    if (path !== "CLAUDE.md" && !AREAS[area].roots.some((root) => (root.endsWith("/") ? path.startsWith(root) : path === root)))
      throw new Error(`Out-of-scope change: ${path}`);
    if (
      /(?:^|\/)(?:\.(?:gitignore|gitattributes|npmrc|yarnrc(?:\.yml)?|node-version|nvmrc|tool-versions)|\.env(?:\.[^/]+)?|\.codex|\.claude|\.agents)(?:\/|$)/.test(
        path,
      )
    )
      throw new Error(`Protected change: ${path}`);
    if (
      /(?:^|\/)(?:node_modules|\.git|\.artifacts|dist)(?:\/|$)|(?:^|\/)(?:(?:package(?:-lock)?|project|nx)\.json|[^/]*\.config\.[^/]+|tsconfig[^/]*\.json|vitest[^/]*\.[^/]+|AGENTS\.md)$|\.(?:rs|wasm)$|(?:known-red|quarantine|baseline|\.min\.)/.test(
        path,
      ) ||
      path.startsWith("libs/compiler/rust/")
    )
      throw new Error(`Protected change: ${path}`);
  }
  if (
    finding.regression &&
    (!AREAS[area].projects.includes(finding.regression.project) ||
      !changed.includes(finding.regression.file) ||
      !/\.test\.[cm]?[jt]sx?$/.test(finding.regression.file))
  )
    throw new Error("Regression outside the maintained area/project");
  for (const path of finding.testPaths) if (!changed.includes(path)) throw new Error("Regression overlay must be a changed named file");
}
