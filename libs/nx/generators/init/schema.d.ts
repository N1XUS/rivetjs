export interface InitGeneratorSchema {
  /** Register `@rivetjs/nx/plugin` in nx.json (inferred targets). Default: true unless `NX_ADD_PLUGINS=false` / `useInferencePlugins: false`. */
  addPlugin?: boolean;
  /** Do not add dependencies to the root package.json. */
  skipPackageJson?: boolean;
  /** Keep versions already in package.json. */
  keepExistingVersions?: boolean;
  /** `@rivetjs/*` dependency spec (default: this plugin's version). */
  rivetVersion?: string;
  /** Do not run the package manager install after generating. */
  skipInstall?: boolean;
  skipFormat?: boolean;
}
