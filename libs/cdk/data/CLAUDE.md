# libs/cdk/data
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

react-stately data hooks as signal factories. Subpath: `data` (index.tsx).

## Files
| File | What |
| --- | --- |
| `list-data.tsx` | `createListData` (useListData), `createListActions`, `listDataState`. |
| `async-list.tsx` | `createAsyncList` (useAsyncList: load / loadMore / sort / filter, abort of stale requests). |
| `tree-data.tsx` | `createTreeData` (useTreeData). |

## Invariants / gotchas
- Members reactive (signal-backed); selection two-way signals.
- Bulk list moves use a stable partition for more than 16 distinct present indices; small moves and duplicate/missing indices retain the upstream splice algorithm. Key lookup order and `getKey` calls are unchanged. `data-list-data.test.ts` covers selected targets, source order and fallback edge cases.
- Resumability: user fns (`getKey`, `getChildren`) wrapped in const holder objects (`keys.get`, `fns`); dispatch via `io = { dispatch }`; request counter `const requests = { next: 0 }` (module `let` → ASSIGN_TO_IMPORT).

## Tests
`tests/data-list-data.test.ts`, `data-async-list.test.ts`, `data-tree-data.test.ts` (react-stately ports), `data-rivet.test.ts`, helper `data-hook-utils.ts`.
- FIX2-CDK 2026-11-01: list `moveBefore` / `moveAfter` find ≥ 5 keys through one key → index map (`indicesOf`; ≤ 4 keys keep the per-key scan; 100 of 1000: 133 → 17 µs); tree `moveItems` tests membership with the existing `removeKeys` Set instead of `keyArray.includes` per node.
