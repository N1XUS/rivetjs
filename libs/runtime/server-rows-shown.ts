// Rows of a list tape the WebAssembly row emitter (`server-rows.ts`) wrote with no string an HTML parser would change
// (CR, NUL, a lone surrogate): tape → n, rows 0..n-1 proven. DOM data (`server-derived-dom.ts`) registers its lists'
// tapes (n = 0) before they are written — the emitter tracks only registered tapes — and skips its per-string "kept as
// written" regex for a list whose rows are all proven. A separate module so neither side pulls the other in.
export const shownRows = new WeakMap<readonly unknown[], number>();
