// Per-page stylesheet inlining (`rivetRouter({ inlineStylesheets })`): which of a page's stylesheet URLs the shell
// writes as `<style>` (`DocumentInput.inlineStyles`), from the client build's `.vite/rivet-inline-css.json`.

/** `.vite/rivet-inline-css.json`: the sheets that may be inlined and the rule the build was configured with. */
export interface InlineStyleManifest {
  /** `"always"`: every listed sheet; `"auto"`: the per-page brotli total, else the per-sheet limit. */
  readonly mode: "auto" | "always";
  /** `auto`: all of a page's listed sheets go inline when their brotli sizes add up to at most this (bytes). */
  readonly maxTotalBrotli: number;
  /** `auto` fallback: a listed sheet of at most this many bytes (raw CSS) goes inline on its own. */
  readonly limit: number;
  /** Stylesheet URL → its CSS, its UTF-8 size and its brotli size (bytes). Sheets with relative references are never listed. */
  readonly sheets: Readonly<Record<string, { readonly css: string; readonly bytes: number; readonly br: number }>>;
}

/**
 * The subset of `styles` (URL → CSS) a page writes inline. `auto`: every listed sheet when their brotli total is at
 * most `maxTotalBrotli` (one render-blocking round trip less: all of the page's sheets arrive with the HTML), else
 * each listed sheet of at most `limit` raw bytes. Results are cached per stylesheet list (bounded by the routes).
 */
export function inlineStylesFor(manifest: InlineStyleManifest): (styles: readonly string[]) => Readonly<Record<string, string>> | undefined {
  const cache = new Map<string, Readonly<Record<string, string>> | undefined>();
  const { sheets } = manifest;
  return (styles) => {
    const key = styles.join("\n");
    if (cache.has(key)) return cache.get(key);
    const listed = styles.filter((href) => Object.hasOwn(sheets, href));
    let total = 0;
    for (const href of listed) total += sheets[href]!.br;
    const all = manifest.mode === "always" || total <= manifest.maxTotalBrotli;
    const out: Record<string, string> = {};
    for (const href of listed) if (all || sheets[href]!.bytes <= manifest.limit) out[href] = sheets[href]!.css;
    const result = Object.keys(out).length ? out : undefined;
    cache.set(key, result);
    return result;
  };
}
