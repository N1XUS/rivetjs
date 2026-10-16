export interface PackageExecutorSchema {
  /** tsconfig of the emit, relative to the project. Default `tsconfig.lib.json`. */
  tsConfig?: string;
  /** Output folder, relative to the workspace root. Default `dist/<projectRoot>`. */
  outputPath?: string;
  /** Source folder the emit is rooted at (= the tsconfig's `rootDir`), relative to the project. Default `src`. */
  sourceRoot?: string;
  /** Extra files copied from the project (README.md and LICENSE are copied when present). */
  assets?: string[];
}
