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
- Resumability: user fns (`getKey`, `getChildren`) wrapped in const holder objects (`keys.get`, `fns`); dispatch via `io = { dispatch }`; request counter `const requests = { next: 0 }` (module `let` → ASSIGN_TO_IMPORT).

## Tests
`tests/data-list-data.test.ts`, `data-async-list.test.ts`, `data-tree-data.test.ts` (react-stately ports), `data-rivet.test.ts`, helper `data-hook-utils.ts`.
