# DOM-backed loader data — strings the page already shows are read back from the DOM, not serialized again (2026-10-20)

- Status: **design + prototype** (lane DOM-DATA). Prototype behind the build switch `rivet({ resume: { domData: true } })`, default **off**; measured on the ssr-bench `/resume?rows=1000&strings=2` grid.
- Position: complements lazy rows (`2026-10-19-lazy-collection-rows-design.md`). Lazy rows drop the per-row *records*; the loader data they leave behind (`data.rows`, captured by the page component and by every `For`'s `items`) is the remaining 400 KB. This spec removes that copy. It composes with lazy rows (§3.5) and works without them.
- Compiler: **no change** (no Rust patch). Registration is runtime-side: row plans already know which tape slots are an element's whole text (§3.1).

## 1. Problem, measured

`/resume?rows=1000&strings=2` (1000 rows × 10 `<dd>{row().values[i]}</dd>` + `data-row={row().id}`), HEAD-equivalent default build, brotli q4 (`split.mjs`) / q11:

| part | raw | br q4 | br q11 |
| --- | ---: | ---: | ---: |
| whole page | 1,624,663 | 53,059 | 39,478 |
| `rivet/state` | 499,266 (30.7 %) | 23,831 | 17,032 |
| page without state | 1,125,397 | ~29.2 K | 22,839 |
| static `/page` (same markup, no resume) | 1,089,312 | 25,565 | 19,021 |

- State `t` = 488,595 B. Nearly all of it is `data.rows` (10,000 strings, ~44 chars each), and those strings are already in the DOM as `<dd>` text.
- Markers and attributes are second order (see the brief's table).
- Lazy rows (`RIVET_LAZY_ROWS=on`) change little here: state 488,739 B. Lazy rows drop the row records, but the items array is still a full `j` tree.

## 2. Principle

- **Content-addressed, not compiler-tagged.**
  - A row plan's template tells us which slots are an element's sole child text, and which are plain attribute values (`rowTexts`).
  - The render registers the values written there, per row: value, path below the row root.
  - The encoder looks for those exact values inside the plain JSON trees it writes, and swaps them for paths.
  - Values match by identity (`===`). A row's lookup is scoped to the row whose item the tree is, so the same string in another row never matches.
- **The DOM is the wire, read once.**
  - The browser rebuilds each tree from the DOM on its first decode.
  - Every tree still unread is rebuilt at the first idle, before any binding, region re-creation or client code can change the nodes.
  - After that the value is plain data.
- **Zero cost off.** `DOM_DATA` is a const switch module, swapped by the Vite plugin. The default runtime folds every branch away (§4).

## 3. Design

### 3.1 Eligibility (Q1) — what is registered

- **Where values come from.** Only list rows.
  - Keyed `For` row plans (`planRows`, structural ids, root-anchored plan: `c.structural && c.anchor && !c.unsafe`).
  - Lazy rows (`lazyRowValue`): the row's compiled template value.
  - No per-text work anywhere else. Non-row text writes are untouched, so the static lane is unaffected.
- **Which slots** (`server-resume-paths.ts` `rowTexts`, computed once per template and cached on the plan or in a `WeakMap`):
  - A content slot whose fragment before ends with the element's start tag, and whose fragment after starts with its end tag. This is the element's sole child (`<dd>{x}</dd>`).
    - `<i>Note: {x}</i>` is not eligible.
    - `<pre>` and `<listing>` are never eligible (they drop a leading newline).
    - Templates the parser could restructure are refused (the same rules as `rowPaths`).
  - An attribute slot whose attribute is plain:
    - html namespace;
    - not boolean, `hidden` or `popover`;
    - not a URL attribute (the unsafe-URL rule may rewrite it);
    - not a resume site (an `_rAttr` binding owns it).
- **Which values:**
  - strings of ≥ 8 chars;
  - finite numbers (written as `String(n)`, read back with `+text`; the path is prefixed `#`).
  - The encoder rejects (`domFits`) strings the parser would change: CR (newline normalisation), NUL, lone surrogates. Entities are fine, because the parser decodes them.
  - Booleans and short strings stay literals: a path costs more than they do.
- **The anchor** is the row root element.
  - Plan rows use element id `rows[k].id + 1` (structural id, `data-r` or a path id).
  - Lazy rows use the row region root, addressed as anchor `-1 - marker`: the element before the `]` end marker.
  - Paths are `tag:i.j` (element-child indexes below the anchor, with the tag checked) or `tag:i.j@name`.
- **Registry** (`server-dom-data.ts` `DomRegistry`, one per render, `Recorder.dom`):
  - one flat array `regs` holding, per row, `anchor, n, n × (value, path)`;
  - `items: Map<item, header>`.
  - Registration costs per row: one `Map.set` and a few pushes. There is no hashing of strings (an earlier global value→registration `Map` cost 1.1 ms/page in `Map.set` alone).

### 3.2 Encoding (Q2) — `D` entries

- `createEncoder({ dom })`. After `jsonTree` accepts a plain tree, `dom.tree` (`server-dom-data.ts` `domTree`) tries the `D` form.
- **Rows node:** an array of ≥ 2 objects that are all registered row items, with evenly spaced anchors of one sign.
  - One merged skeleton serves every row.
  - A row whose leaf is missing or rejected becomes a per-row exception `(row, k, value)`. The column stays DOM-backed for every other row.
- **Single tree:** a tree that is itself a row item uses the item's anchor. Any other tree has anchor `null`: its own leaves are literals, and only its rows nodes read the DOM.
- **Wire:**
  ```
  { D: [shape, anchor | null, ...stream] }
  shape → { j: [skeleton, paths, subs] }   // interned, shared
  skeleton leaf: 0 = next literal, k ≥ 1 = paths[k-1], k < 0 = rows node subs[-1-k]
  rows node stream: first anchor, stride, count, n, n × (row, k, value), then each row's literals
  ```
- **Order and identity:**
  - Keys stay in insertion order, and arrays keep their length (real arrays).
  - Nested objects other entries reference stay `i` children of the `D` entry (`within()`), so identity holds. The page's `data`, the `For` items and each row's captured `row()` are the same objects.
- **Runs:**
  - With non-lazy rows each row item is its own entry (the row captures it first), so 1000 single `D` entries share one shape.
  - ≥ 3 consecutive single trees of one shape with arithmetic anchors become `{Dr: [shape, a0, stride, count, ...literals]}` plus `0` placeholders. The runtime `expand`s them back before decoding.
- **Floor:** a tree saving < 32 characters stays `j` (`DOM_MIN`).
- **Encoder cost:** the shape of the previous single tree is memoised (`DomLast`), so the per-row-entry case is compare-and-stream only.
- **State flag:** `state.D = 1` when the table holds `D` entries.

### 3.3 Browser (Q3) — `dom-resume-data.ts`

- `_domData({ element, row })` is built by `dom-resume` only under `DOM_DATA`. It provides:
  - `expand(table)` — `Dr` runs back to `D` entries;
  - `dom(tree, get)` — the decoder hook (`DecoderHooks.dom`, `resume-format.ts` decoder right after the `j` case, under `DOM_DATA`);
  - `sweep(table, get, decoded)`.
- **Reading a path:**
  - Walk `children[i]` from the anchor, check `localName`, then read `textContent` or `getAttribute`.
  - Anchor ≥ 0 resolves through `element(id)` (`data-r` / `w` path ids).
  - Anchor < 0 resolves to the row marker's `end.previousElementSibling`.
- **Mismatch:** a missing element or a wrong tag throws (`DEV.hint(..., "drift")` in dev, else "Missing resume DOM data …"). A markup change never produces wrong data silently.
- Entities come back decoded, which is the server's original string. Whitespace is never collapsed: a sole-child text node is exactly the written string.

### 3.4 Mutation (Q4) — snapshot rule

- A tree is read on its first decode.
- At the first idle after start (and after each streamed patch), `sweep` decodes every `D` entry still undecoded. A failure is left for its first reader, which gets the same error; dev warns.
- Idle runs before the resumed bindings could run. The first binding write needs an event or signal change, and those decode the entries they touch first.
- From then on the value is plain data: later DOM edits never reach it.
- Tested: after idle, every `<b>` and `data-id` is edited, and the decoded rows still deep-equal the server data.
- Risk: client code that rewrites server nodes before idle, without going through resume (a third-party script mutating the DOM at `DOMContentLoaded`). That is already "drift" for resume; the reader throws on a tag mismatch, but not on edited text. See §6.

### 3.5 Lazy rows and the parent capture (Q5)

- Lazy rows do not generalise this: they rebuild row *records* from (row function, item), but the item itself still comes from the state.
- The real remaining copy is the parent capture (`ResumePage`'s `data`, and the `For` items `() => data.rows`). This design shrinks exactly that.
  - With lazy rows, the whole `data` tree becomes one `D` entry, and `data.rows` is a rows node anchored at the row regions (`-1 - marker`): state `t` 2,936 → **843 B**.
  - Without lazy rows, the per-row item entries become `Dr` runs.
- **Bug fixed on the way** (pre-existing, default build): the lazy add-on found a row's range by `(items.j || items).length`. That is undefined when the items are an `i` child of a tree (`each={() => p.rows}`) or a `D` tree, so cold clicks in such lazy rows never woke the runtime.
  - The `LazyRowsEntry` now carries `count` at [13] (after LAZY-T6 `keyed` [12]) when the items entry does not show it.
  - The add-on reads `e[13] || (items.j || items).length`.
  - The browser test covers the default build too.

## 4. Build switch, zero cost

- Three switch modules, all swapped by `libs/compiler/vite.ts` `load` (`domDataSwitch`) when `resume.domData` is set (the `lazy-rows.ts` pattern):
  - `libs/runtime/dom-data.ts`: `export const DOM_DATA = false as boolean`;
  - `dom-data-resume.ts`: `_domData = null` (browser reader);
  - `dom-data-server.ts`: `domServer.create = null` (server registry + encoder, `server-dom-data.ts` `_domRegistry`).
  - SSR builds bundle `@rivetjs/*` (`ssr.noExternal`), so the server switch is swapped too.
- Manifest flag `domData: true`, dev and prod. The plugin warns when the client switch was never loaded.
- Default build:
  - `/dom-resume`: same bytes (45,563 min); every `if (DOM_DATA …)` branch folds away.
  - `/server-resume`: +775 B min; it keeps `recorder.dom === null` checks, the `RowPlan.source` tuple and the lazy-rows `count` slot (§3.5).
  - `/resume-format`: +158 B min (the encoder's `dom.tree` call, the decoder's folded `D` case).
- Opted in:
  - dom-resume 47,316 min / 16,316 br, i.e. +1,753 / +558;
  - server-resume 122,093 min, i.e. +5,849 min / +1,678 br.
  - Zero-cost lines: `[domData]` for `/dom-resume` and `/server-resume`.
- The lazy-rows `count` slot (§3.5) is a default-build format addition. It is written only when the items entry is not a `j` tree or a ref array. The loader-min regeneration changes the `LAZY` add-on (+4 B in `[lazyRows]` dom-resume).

## 5. Numbers (measured 2026-10-20, snapshot; host shared with other lanes, load average 8–32)

| page `/resume?rows=1000&strings=2` | raw | br q4 | br q11 | state raw | state br q4 | state br q11 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| default | 1,624,663 | 53,060 | 39,775 | 498,631 | 23,831 | 17,032 |
| `domData` | 1,134,013 | **31,862** | 24,344 | **7,981** | 2,661 | 1,527 |
| lazy rows | 1,619,378 | 50,133 | 35,792 | 488,454 | 20,644 | 15,580 |
| lazy rows + `domData` | 1,132,730 | **29,559** | **21,045** | **1,806** | 843 | 744 |
| static `/page` (reference) | 1,089,312 | 25,569 | 19,343 | 1,194 | 616 | 550 |

- `domData` alone: the state is 7,981 B; the target was ≲ 20 KB. What remains:
  - `b` (packed bindings with the per-row `r` refs list) 4.2 KB;
  - `t` 2.9 KB.
- Page br q4 31.9 KB alone (just above the ≲ 30 KB target); 29.6 KB with lazy rows (meets it). Solid 2 hydratable sits at ~1,091 KB raw; the domData page is 1,134 KB raw.
- Follow-up to reach < 30 KB without lazy rows: strided packed-binding `r` refs. They touch the loader. Estimate ≈ 30.1 KB q4.

Server CPU, ms/page:

- Measured as process CPU incl. GC / compiler threads: `ps` delta / responses.
- Loadgen closed loop, 10 s per point. Run A = 14:08 (load 8 → 32), run B = 14:26 (final code, load 15–22). Each run = two passes in reversed order.
- The host is shared with other lanes, so the noise is ±10 %.

| lane | c1 run A | c1 run B | c10 run A | c10 run B |
| --- | ---: | ---: | ---: | ---: |
| `/resume` default | 5.21 | 5.72 | 4.06 | 4.39 |
| `/resume` `domData` | 5.57 | 5.46 | 4.78 | 4.80 |
| `/resume` lazy rows | 7.30 | 7.34 | 6.65 | 6.95 |
| `/resume` lazy rows + `domData` | 8.80 | 9.65 | 7.94 | 8.29 |
| static `/page` (default build / `domData` build) | 3.32 / 3.66 | 3.49 / 3.51 | 2.97 / 2.77 | 2.96 / 2.90 |

- `domData` alone: −0.3 to +0.7 ms/page (within noise to +18 %).
  - Sequential curl, 300 requests × 2: default 5.90–6.16, `domData` 5.83–6.23.
  - Registry by identity and flat (§3.1): the first prototype, with a global value `Map`, cost +3.3 ms.
- Lazy rows + `domData`: +1.3 to +2.3 ms/page.
  - Main-thread profile: the `dom*` functions cost ~0.8 ms/page.
  - With `--single-threaded` the delta is +0.3–0.4 ms, so the rest is on V8 background threads.
  - Open (T2).
- Static `/page` does not use resume: the difference is noise.
- Browser (Chromium, real ssr-bench pages, all four builds):
  - clicks in rows 1 / 500 / 1000 and, after idle, 250 select their row;
  - no page errors, no `rivet:resume-error`.
- Resume-bench was not run: its fixture is the 1000-row `{id,label}` list, not this grid.

## 6. Risks and open points

- DOM text edited before idle by non-resume code: the value comes back edited. Only tag checks guard it. Options: a per-tree hash (costs bytes), or the documented rule "do not mutate server markup before the runtime starts" (proposed).
- CPU: lazy rows + `domData` adds ~1.3–2.3 ms/page (≈ 20–30 %), mostly off the main thread. Profile GC pressure from the registry (`regs` grows to ~24 k slots → large-object space). Candidate: a registry that holds the tape / slots reference per row instead of copying values.
- Registration covers list rows only. Single-element loader data (`<h1>{data.title}</h1>`) stays literal. Extending it needs per-site anchors (a `data-r` id) on non-row elements, which would cost bytes on every page: out of scope.
- `textContent` of an element with comment children (`<!--…-->` text-split markers) is still exact: comments are not text. A sole-child slot never has them.
- Sweep cost in the browser: 1000 rows × 11 reads at idle (not measured: no resume-bench lane for the grid).
- Default servers still grow +445 B min per app (size-report `serverJS`): the `dom` checks, `RowPlan.source` and the lazy `count` fix. A source tuple made only when the registry asks for it would cut most of that.

## 7. Gate (before the default moves)

- Correctness:
  - `tests/resume-dom-data.test.ts` (node: `rowTexts`, encoder rows nodes / exceptions / floor / tag check);
  - `tests/resume-dom-data-browser.test.ts` (Chromium: default build, `domData`, `domData` + lazy rows; values deep-equal, identity list ↔ row, snapshot after idle, lazy cold clicks).
- Resume fuzz with `domData` on (cdk / ui) green.
- CPU: `domData` ≤ +2 % ms/page on ssr-bench rivet-resume c1 / c10 (Docker harness, not a shared laptop), with and without lazy rows.
- Bytes: page br ≤ static `/page` + 15 % on the grid; the default build has the same bytes (zero-cost).

## 8. Tasks

1. T1 (done, prototype):
   - switch modules + Vite swap + manifest flag;
   - registry (`rowTexts`, `domRows`, `domLazyRow`);
   - encoder `D` / `Dr`;
   - reader + sweep;
   - the lazy `count` fix;
   - tests.
2. T2: CPU. Registry by reference (no value copy), measured in the Docker harness. Target: the +2 % gate.
3. T3: strided packed-binding `r` refs (state `b` 4.2 KB → ~0.3 KB), for the < 30 KB target without lazy rows.
4. T4: resume fuzz with `domData`. Add a grid lane to resume-bench (sweep cost, click-to-interactive).
5. T5: default flip decision (with lazy rows' T6).

## 9. Rulings proposed

1. Default **off** until T2 passes the CPU gate; then on together with lazy rows.
2. Snapshot at the first idle (not eager at start, not on every read).
3. Content-addressed registration in the runtime; no compiler tagging, no Rust patch.
4. Eligibility: whole-element text + plain attributes, strings ≥ 8 chars + finite numbers; CR / NUL / lone surrogates refused.
5. Rows nodes with per-row exceptions (one odd row never turns a whole column literal).
6. Lazy-rows `LazyRowsEntry[13] = count` lands with this (it fixes default-build cold clicks over `i` / `D` items).
7. Rule for users: server markup must not be changed before the runtime starts (documented in `docs/guides/resumability.md`).
