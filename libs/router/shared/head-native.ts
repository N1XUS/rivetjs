// Server-only native framework head protocol. Browser #native-head resolves to constant stubs so ordinary Kit clients
// retain their previous head merge/serialization bytes. No enumerable JSON field can request raw HTML rendering.
import type { Head, HeadRendering } from "./data.ts";
import type { HeadTagOptions, RankedHead } from "./head.ts";

const HEAD_RENDER = Symbol.for("rivet.head.render");
const renderingOf = (head: Head): HeadRendering | undefined => (head as Head & { [HEAD_RENDER]?: HeadRendering })[HEAD_RENDER];
type Merge = (entries: readonly RankedHead[]) => Head | undefined;
type Tags = (head: Head | undefined, options?: HeadTagOptions) => string;

/** Preserve non-enumerable native ownership when i18n translation clones normalized fields. */
export function copyHeadRendering(from: Head, to: Head): Head {
  const extension = renderingOf(from);
  if (extension) Object.defineProperty(to, HEAD_RENDER, { value: extension });
  return to;
}

/** No allocations until the first native contribution. The returned function finalizes an ordinary rank merge. */
export function prepareNativeHead(sorted: readonly RankedHead[]): ((merged: Head, merge: Merge) => Head) | undefined {
  let native: HeadRendering[] | undefined;
  let ordinary: RankedHead[] | undefined;
  let nativeTitles = 0,
    nativeTitleRank = -1,
    ordinaryTitleRank = -1;
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]!,
      head = entry.head,
      rendering = renderingOf(head);
    if (rendering && typeof rendering.render === "function") {
      native ??= [];
      ordinary ??= sorted.slice(0, i);
      native.push(rendering);
      nativeTitles += rendering.titles;
      if (rendering.titles) nativeTitleRank = i;
      if (rendering.normal) {
        ordinary.push({ ...entry, head: rendering.normal });
        if (rendering.normal.title !== undefined) ordinaryTitleRank = i;
      }
    } else {
      if (ordinary) ordinary.push(entry);
      if (head.title !== undefined) ordinaryTitleRank = i;
    }
  }
  if (!native) return undefined;
  const extensions = native;
  return (merged, merge) => {
    let normal = merge(ordinary!);
    // Native title nodes cannot be dropped/reordered safely (Vue), and global document.title writes (Svelte) cannot
    // preserve priorities among competing authors. Reject those cases explicitly instead of emitting duplicate titles.
    if (nativeTitles > 1 || (nativeTitles && (ordinaryTitleRank > nativeTitleRank || merged.titleTemplate !== undefined)))
      throw new Error("Native island head titles require one title author: remove the higher-ranked route/Kit title, titleTemplate, or other island title.");
    if (normal) {
      normal = { ...normal };
      if (nativeTitles) delete normal.title;
      // Ordinary lower-rank fields overridden by native entries should not be serialized twice. Native ranges remain
      // intact even when two framework roots own the same metadata key: each hydrator must retain its own nodes.
      if (normal.meta) {
        const final = new Set(merged.meta);
        normal.meta = normal.meta.filter((entry) => final.has(entry));
      }
      if (normal.links) {
        const final = new Set(merged.links);
        normal.links = normal.links.filter((entry) => final.has(entry));
      }
      if (normal.styles) {
        const final = new Set(merged.styles);
        normal.styles = normal.styles.filter((entry) => final.has(entry));
      }
    }
    Object.defineProperty(merged, HEAD_RENDER, {
      value: {
        normal,
        titles: nativeTitles,
        boot: extensions.find((entry) => entry.boot)?.boot,
        render: () => extensions.map((entry) => entry.render()).join(""),
      } satisfies HeadRendering,
    });
    return merged;
  };
}

export function renderNativeHead(head: Head | undefined, options: HeadTagOptions, tags: Tags): string | undefined {
  const rendering = head && renderingOf(head);
  return rendering && typeof rendering.render === "function" ? tags(rendering.normal, options) + rendering.render() + (rendering.boot?.() ?? "") : undefined;
}

/** Ordinary late body-valid fallback; native ranges require the document head hold and cannot degrade safely. */
export function lateHeadTags(head: Head, options: Pick<HeadTagOptions, "nonce">, tags: Tags): string | undefined {
  if (renderingOf(head))
    throw new Error("Native island head rendered after the document head hold: move this island outside the streamed boundary or increase the head hold.");
  return (
    tags(
      { ...(head.links ? { links: head.links } : {}), ...(head.scripts ? { scripts: head.scripts } : {}), ...(head.styles ? { styles: head.styles } : {}) },
      options,
    ) || undefined
  );
}
