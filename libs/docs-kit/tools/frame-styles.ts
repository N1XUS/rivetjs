// Example frame stylesheets in a client build (`virtual:docs/frame-styles`, vite.ts `docsFrames`): per frame the CSS of
// its wrapper chunk's static import closure, then merged: the group sheet (`src/generated/example-css/<hash>.css`,
// Tailwind + the ui base, shared by every frame of its group: cached once) stays its own link, the frame's component
// sheets become ONE `assets/frame-<hash>.css` (the router's `mergeRouteCSS`: same top-level dedupe, same list → same
// asset). A frame with one component sheet keeps it.
import { mergeRouteCSS } from "@rivetjs/router/vite";
import type { Rollup } from "vite";

/** Frame id → stylesheet URLs (post-order: a chunk's static imports' CSS precedes its own, like the router's route CSS). */
export function frameStyleLists(
  chunks: readonly Rollup.OutputChunk[],
  holders: ReadonlyMap<string, Rollup.OutputChunk>,
  base: string,
): Record<string, string[]> {
  const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const styles: Record<string, string[]> = {};
  for (const [id, chunk] of holders) {
    const css: string[] = [];
    const seen = new Set<string>();
    const visit = (current: Rollup.OutputChunk) => {
      if (seen.has(current.fileName)) return;
      seen.add(current.fileName);
      for (const file of current.imports) {
        const imported = byFile.get(file);
        if (imported) visit(imported);
      }
      for (const file of current.viteMetadata?.importedCss ?? []) if (!css.includes(base + file)) css.push(base + file);
    };
    visit(chunk);
    styles[id] = css;
  }
  return styles;
}

/**
 * Group sheets stay, the rest of each list merges into one asset. `isGroup(chunk)`: the chunk holds a group stylesheet
 * module (its CSS is the group sheet). Returns the frame map and the merged assets to emit.
 */
export function mergeFrameStyles(
  bundle: Rollup.OutputBundle,
  styles: Record<string, string[]>,
  base: string,
  isGroup: (chunk: Rollup.OutputChunk) => boolean,
): { frames: Record<string, string[]>; assets: { fileName: string; source: string }[] } {
  const group = new Set<string>();
  for (const output of Object.values(bundle))
    if (output.type === "chunk" && isGroup(output)) for (const file of output.viteMetadata?.importedCss ?? []) group.add(base + file);
  const rest: Record<string, string[]> = {};
  for (const [id, list] of Object.entries(styles)) rest[id] = list.filter((href) => !group.has(href));
  const { routes, assets } = mergeRouteCSS(bundle, rest, base, "frame");
  const frames: Record<string, string[]> = {};
  for (const [id, list] of Object.entries(styles)) frames[id] = [...list.filter((href) => group.has(href)), ...(routes[id] ?? [])];
  return { frames, assets };
}
