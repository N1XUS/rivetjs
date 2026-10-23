# @rivetjs/compiler/oracle

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Parity corpus: recorded `compile` / `moduleFacts` outputs the wasm compiler must reproduce. Part of the zero-cost gate.

## Layout

- `corpus.jsonl` — 176 cases, one JSON per line: `{ kind: "compile" | "moduleFacts", args, result }`. `args` = `[source, options?]` for compile (options seen: `target`, `filename`, `resume` = `{ module, boundaries?, independent? }` (the derived model), `serverListMounts`, `staticCalls`, `styles`, `serverExports`) or `[source, filename]` for facts. Values tagged `{ $map: [...] }`, `{ $set: [...] }`, `{ $undefined: 1 }` (see `tag`/`untag` in `check.ts`). Originally captured from the former TypeScript compiler; re-recorded case-by-case since (history: git log of this file).
- Resume cases: 91 (RV2001 browser global, server); 168–171 derived `page.tsx` (the runtime derived fixture) server + dom with build verdicts and `local.tsx` (concise arrow boundary, non-exported boundary, default export with a directive, `createStore`, early `return null`) server + dom with module-local verdicts; 172 / 173 derived boundary eligibility (`renderer.tsx`: a PascalCase factory returning an object literal — no boundary —, an accessor component and a mixed object / JSX return — boundaries —, a conditional keyed signal — no RV2104 —) server + dom.
- 174 / 175 EXT-A (2026-10-22, alpha.1 report item 1) `svg-link.tsx` — an `<a>` root wrapping an `<svg>` icon stays an HTML template (flag 0; the SVG-only tags inside the nested `<svg>` do not count), an `<a>` holding `<g>` stays SVG (flag 1), dom + server (main 247 / 248, appended after the M6-CUT renumbering).
- M6-CUT-RUST (2026-10-22): the serialized resume model was deleted — its 73 cases (`resume` without `model: "derived"`: symbols / `_rOn` / `_rBind` records, lazy-rows verdicts, resource recipes, member captures, `_rMod` / `_rClass` stamps) removed, 247 → 174; the 6 derived cases' args lost the `model: "derived"` key (results unchanged). Older history (SRV-SIMPLIFY, V2-DEL, IMPL-*, Function Bridge, LAZY-ROWS, DERIVED-S, …) numbered cases before this cut: see git history.
- M6-PARITY 6b (2026-10-22): the 10 `moduleFacts` cases (1, 2, 3, 4, 131, 134, 135, 136, 153, 154) re-recorded result-only — `moduleFacts()` always returns the export maps `exports` / `reexports` / `stars` / `compounds` (re-export + compound tag resolution of the derived boundary fixpoint); every other field and every compile case unchanged.
- `check.ts` — runner: `node libs/compiler/oracle/check.ts [index]` (`nx run compiler:parity`, `npm run parity -w @rivetjs/compiler`). Prints failing cases with field diffs, then `N/176 corpus cases match`; exit 1 on any mismatch.
- `record.ts` — `node libs/compiler/oracle/record.ts <source.tsx> '<compile options JSON>'` appends one `compile` case recorded with the current wasm (refuses sources with diagnostics). Re-recording existing lines stays a one-off (below).

## Rules

- Diagnostics must match exactly. `code` is compared after esbuild `minifyWhitespace` + `minifySyntax` (identifiers never renamed) — formatting may change, structure may not.
- Also consumed by `../tests/source-map.test.ts` (maps change no code, every case) and `../tests/i18n.test.ts` (unused `staticCalls` byte-identical).
- Must pass before any compiler change is reported: `sh scripts/zero-cost/check.sh` runs it last.

## Re-recording (intended output changes only)

1. Confirm the delta is intended (new ABI, renumbered symbols) and the zero-cost baselines are being updated in the same change.
2. Run `node libs/compiler/oracle/check.ts` → note failing case indices and diffs.
3. Rewrite only those lines: load the line, call `compile(...args)` / `moduleFacts(...args)` with the new wasm, store the raw result (not the esbuild-normalised form) with `JSON.stringify(result, tag)`. No recorder script is checked in — write a one-off in the scratchpad; keep line order and untouched cases byte-identical.
4. Mention the re-recorded case count in the commit message (precedent: `65808f17`, "four oracle corpus cases re-recorded"; older precedents numbered cases before the M6 cut — git history). Helper: a `{ $undefined: 1 }`-aware rewrite of chosen lines with the current wasm (`compile(...args)`, `result` replaced, other lines untouched).

## Gotchas

- `check.ts` imports `../index.ts` directly: it exercises the committed `../rivet_compiler.wasm` — rebuild first after Rust edits.
- A single-case run (`check.ts 12`) reports `1/1`; the zero-cost script greps the last line, so keep the summary format.
