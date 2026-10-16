export interface TypecheckExecutorSchema {
  /** tsconfig file, relative to the project. Default `tsconfig.json`. */
  tsConfig?: string;
  /** Run `rivet sync` first, so `.rivet/routes.d.ts` is current. Default: routed apps only. */
  sync?: boolean;
}
