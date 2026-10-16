export interface LibraryGeneratorSchema {
  /** Project folder, workspace-relative (`libs/ui-kit`). */
  directory: string;
  /** Project name (default: the folder name). */
  name?: string;
  /** npm name (default `@<workspace scope>/<name>`, or `<name>` without a scope). */
  importPath?: string;
  /** Publishable: a `build` target (`@rivetjs/nx:package`) emitting `.js` / `.jsx` + `.d.ts` into `dist/<directory>`. */
  publishable?: boolean;
  /** Extra subpath exports (comma-separated: `button,card` → `<importPath>/button`, …), each tree-shakeable on its own. */
  subpaths?: string;
  unitTestRunner?: "vitest" | "none";
  tags?: string;
  rivetVersion?: string;
  addPlugin?: boolean;
  skipPackageJson?: boolean;
  skipInstall?: boolean;
  skipFormat?: boolean;
}
