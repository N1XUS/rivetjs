// Development build (`development` condition of the cdk `#dev` import, package.json): dev-only warnings run.
// Rivet (not upstream): `devWhere()` says where a cdk development warning was triggered.
// `globalThis[Symbol.for("rivet.locate")]` is installed by the dev runtime in the browser (`@rivetjs/runtime` dev/where.ts:
// the component chain, `in <TextField> (src/form.tsx:4:17) ← <Page> (…)`) and by the compiler's Vite plugin on the dev
// server (the app's source-mapped stack frames, `at Page (src/routes/index.tsx:12:7)`); plain Node has none → "".
export const DEV: boolean = true;

/** `\n  in <…>` / `\n  at …` for the current dev caller, or "". */
export function devWhere(): string {
  const locate = (globalThis as { [key: symbol]: unknown })[Symbol.for("rivet.locate")];
  try {
    const text = typeof locate === "function" ? (locate as () => string)() : "";
    return text ? "\n  " + text : "";
  } catch {
    return "";
  }
}
