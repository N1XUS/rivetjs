# @rivetjs/ui per-component CSS (identity T4, 2026-10-12)

Spec `docs/design/specs/2026-10-11-ui-identity-design.md` §3.4, plan T4. Before: every page linked the whole `@rivetjs/ui/styles` bundle (all components). After: each component's tv module imports `styles/out/<name>.css`; the router merges a route's stylesheets into one `assets/route-<hash>.css`.

## Method
- `node scripts/size-report/ui-components.mjs` (raw: `scripts/size-report/ui-components.{json,md}`): client builds of `scripts/size-report/fixtures/ui-pages/<name>.tsx` (one route each, starter-ui setup). Page CSS = the sheets linked before first paint (app styles + route sheet), minified / brotli, k = 1000 B.
- Before = the same script at T1 (single bundle, 2026-10-12 morning tree). JS deltas include 10 commits + other lanes' WIP between the runs (not attributed to T4).
- Docs home `/`: `apps/docs` production build, `node apps/docs/scripts/home-perf.ts --lighthouse` under the bench lock (Lighthouse mobile, median of 3).

## Pages (CSS before first paint)
| page | before CSS | after CSS | sheets | before JS | after JS |
| --- | --: | --: | --: | --: | --: |
| button | 719.36 k / 51.46 k | 49.01 k / 5.66 k | 2 | 190.02 k / 54.83 k | 200.41 k / 55.20 k |
| select | 719.36 k / 51.46 k | 65.91 k / 7.25 k | 2 | 465.76 k / 116.79 k | 520.15 k / 118.35 k |
| table (data-table) | 719.38 k / 51.43 k | 57.60 k / 6.40 k | 2 | 422.66 k / 108.09 k | 471.93 k / 109.30 k |
| three (button + select + table) | 719.36 k / 51.46 k | 71.18 k / 7.81 k | 2 | 386.74 k / 99.02 k | 449.51 k / 100.77 k |

- Brotli CSS: button −89 %, select −86 %, table −88 %. The floor is the app sheet (`@rivetjs/ui/styles`: preflight, tokens, base, `out/theme.css`): `out/base.css` 52.46 k / 4.76 k.
- Component files: `out/button.css` 8.63 k / 1.51 k, `out/select.css` 17.61 k / 2.50 k, `out/table.css` 18.42 k / 2.31 k (incl. the `@property` registrations each file uses; the whole set in `out/all.css` 863 k / 53.3 k).
- Theme fallbacks inlined into each file (`var(--x, value)`) were tried and dropped: button.css 10.38 k / 1.68 k, all.css 929 k / 54.3 k. Sites that compile their own Tailwind import `out/theme.css` as `layer(theme.ui)` instead.

## Gate
- `npm run size-report` records per route `cssSheets` + `css` (the stylesheets the HTML links); `--check` fails on growth or an extra sheet. Baseline rows added in this change (other fields untouched): starter-ui `/` 2 sheets, 60.93 k / 7.56 k (the starter's whole `@rivetjs/ui/styles` bundle before: ~720 k / 51 k); every other app 0–2 sheets, unchanged CSS.

## Docs home `/` (2 sheets: docs styles + route sheet)
| | sheets | route sheet | Lighthouse | FCP | LCP | CLS |
| --- | --: | --: | --: | --: | --: | --: |
| 172a4a91 (single ui bundle subset, `routes-*.css`) | 2 | 88.7 k / 8.06 k | 99 | 1352 ms | 1802 ms | 0 |
| T4 split, per-file links (no merge) | 16 | — | 98 | +150 ms | +150 ms | — |
| T4 merged route sheet | 2 | 97.0 k / 9.35 k | 100 | 813 ms | 1052 ms | 0 |

- The last row also contains the DOCS-LCP lane's WIP in the same tree (fonts after first paint, critical CSS): the FCP / LCP gain is mostly theirs; T4's share is the sheet count (16 → 2) and +1.3 k brotli of route CSS (the home's components now get their full stylesheets, incl. the `select` trigger border and transitions that were undefined before: `--border-width-field` read at `:root` outside the scoped theme).
- Merge: `mergeRouteCSS` (libs/router/build/route-css.ts) joins a route's files in order, `dedupeTopLevel` drops repeated top-level `@property` / `@keyframes` / `@layer` statements; same list → same asset.

## Identity
- Computed styles, split vs single bundle injected (component links blocked): 45 story routes × light / dark, 0 differences; docs home split vs fallback build: 0 differences (custom-property spelling aside).
- `libs/ui/tests/styles-split.test.ts`: union of `out/` = single bundle rule for rule; no equal-specificity cross-file conflicts; every composed class's stylesheet imported.
