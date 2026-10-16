export interface CheckExecutorSchema {
  /** tsconfig file(s) to check, relative to the project. Default `tsconfig.json`. */
  tsConfig?: string | string[];
  /** Type-aware checks (RV2101 serializability, RV3101 route links). Default true. */
  types?: boolean;
  /** Check `.rivet/editor.json` (RV7101 / RV7102). Default: routed apps only. */
  manifest?: boolean;
  /** Run `rivet sync` first (regenerates `.rivet/`). Default: routed apps only. */
  sync?: boolean;
  /** Output format. */
  format?: "text" | "json";
}
