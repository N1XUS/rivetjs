// The lite runtime's one-way fallback target (`dom-lite.ts` `fallback`): only the full runtime's default export (its
// `start` hands the page's delegation to it: `$$rvOn`). A dynamic import of `dom-derived.ts` itself would name a module
// whose chunk also serves the ordinary modules' imports (a fallback's `<Name>$c` module), so the bundler would build a
// namespace object with its runtime helper (ZERO LITE-WIRE).
export { default } from "./dom-derived.ts";
