// Development build (`development` condition of the bridge `#dev` import, package.json): dev-only checks and
// attributes run (`data-rf` / `data-rc`, slot hole checks, call-site locations in errors).
export const DEV: boolean = true;

/** `\n  in <…>` / `\n  at …` for the current dev caller (`globalThis[Symbol.for("rivet.locate")]`), or "". */
export function devWhere(): string {
  const locate = (globalThis as { [key: symbol]: unknown })[Symbol.for("rivet.locate")];
  try {
    const text = typeof locate === "function" ? (locate as () => string)() : "";
    return text ? "\n  " + text : "";
  } catch {
    return "";
  }
}
