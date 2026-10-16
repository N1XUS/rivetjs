export interface ComponentGeneratorSchema {
  /** Component name (PascalCase or any case: `user-card` → `UserCard`). */
  name: string;
  /** The app or library. */
  project: string;
  /** Folder under the project's `src` (default `components` for apps, `` for libraries). */
  directory?: string;
  /** `basic` (signal + inline handler) or `overlay` (trigger + panel with render-function children). */
  kind?: "basic" | "overlay";
  /** Write `<Name>.test.tsx`. Default: when the project has a vitest config. */
  test?: boolean;
  /** Story page route `src/routes/stories/<name>.tsx` (apps only). */
  story?: boolean;
  /** Re-export from the library's `src/index.ts`. Default: true for libraries. */
  export?: boolean;
  skipFormat?: boolean;
}
