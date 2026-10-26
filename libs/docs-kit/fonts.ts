/// <reference types="@rivetjs/kit/client" />
// Docs fonts as @rivetjs/kit `?font` imports (FONT-DOGFOOD, DOCS-FAST 2026-10-26): self-hosted variable Manrope (text)
// and Fira Code (code), each with kit's metric-matched fallback face (`"<family> Fallback"`: local Arial / Courier New
// with size-adjust + ascent / descent / line-gap overrides from @capsizecss), so the swap to the web font does not
// re-wrap lines (cdk-docs home CLS 0.136 → 0.0001, /components/button/ 0.0003; slow 4G). The `@font-face` sheets ride
// with `SiteFrame.tsx` (every docs page; example frames have their own fonts). No preload: Chrome holds the first paint
// for an in-flight preloaded font (measured +100–150 ms FCP on slow 4G, same CLS); the browser fetches each face only
// for text that uses it (Fira Code: `code`, `pre`, `kbd`, …).
import sans from "@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?family=Manrope&weight=200..800&fallback=Arial&font";
import mono from "@fontsource-variable/fira-code/files/fira-code-latin-wght-normal.woff2?family=Fira+Code&weight=300..700&fallback=Courier+New&font";

export const FONTS = { sans, mono };
