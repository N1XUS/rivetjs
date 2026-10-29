# Stabilization: first verified baseline

> Execution: systematic root-cause investigation and regression-first fixes in the main checkout. Independent UI, CDK and CLI investigations use separate agents; browser suites are serialized. No new features or API changes are part of this work.

**Goal:** turn the failures from CI run [40906895437](https://github.com/N1XUS/rivetjs/actions/runs/40906895437) into reproduced, classified cases; fix existing behavior without hiding failures behind warm-up, exclusions or larger timeouts.

**Architecture:** preserve the derived resume model and its existing scheduling contracts. Correct missing dependency information or event handling where proven; synchronize tests with observable behavior where a race is proven. Known-red registry entries are removed only after their original tests pass.

**Tech stack:** Node 24 CI / Node 26 host, Vite production builds, Vitest, Playwright Chromium/WebKit, existing Rivet gates. No dependency installation or new toolchain.

## Workspace constraints

- Keep user work in `.github/workflows/ci.yml`, root `CLAUDE.md`, `libs/forms/**`, `examples/**`, `.claude/launch.json` and the lane-harness spec intact.
- Compiler Rust changes and Docker rebuilds belong to the root agent only.
- Use separate story build outputs, one heavy command per investigator and at most 3 GB per process tree. Never overlap resume fuzz with another browser suite.
- Diagnostics: `.artifacts/stabilization/`, `/private/tmp/rivet-ci-40906895437/`.

## Task 1: classify the existing CI failures

- [x] Download each failed job's log; retain exact test names, assertions and reproduction commands.
- [x] Separate runtime/UI behavior, test synchronization, environment differences and size-baseline drift.
- [x] Reconcile every failed job with a reproduction or an explicit unresolved entry below.

## Task 2: CLI subprocess color environment

Files: `libs/router/tests/cli-output.test.ts`, `libs/language-core/tests/cli-output.test.ts`, nearest `CLAUDE.md` files.

- [x] Reproduce the four failures with `FORCE_COLOR=1` under Node 24.
- [x] Clear inherited `FORCE_COLOR` when the test explicitly requests `NO_COLOR`; retain exact stderr assertions.
- [x] Verify affected projects and formatting: language-core 58/58, router 416/416 before the later live-page fix; targeted Node 24 color checks 6/6.

## Task 3: cold Resizable imperative handles

Files: `libs/cdk/resizable/index.tsx`, its documentation, `libs/cdk/tests-components/resizable.test.ts` and its story.

- [x] Reproduce the existing cold imperative panel-ref failure without warming the page.
- [x] Trace the tail: a deferred Group leaves its Panel's plain `current` ref unassigned at the parent's first handler.
- [x] Cover group handles, manually created object refs and arbitrary callback refs as well as the provided panel-ref helper.
- [x] Declare actual imperative-handle registration as an external render side effect using the existing `_rEager` mechanism. This joins parent adoption; it does not boot components before input.
- [x] Pass original cold, keyboard, layout-persistence and no-pre-input-code tests; no-ref groups keep ordinary scheduling. Focused 8/8, full CDK components 514/514.

## Task 4: theme, sidebar and DOM identity regressions

Files: UI component tests and the smallest implicated production runtime/UI modules, chosen from the reproduction.

- [x] Reproduce the theme baseline race under CPU throttling: deferred Slider adoption changes markup after the fixed wait.
- [x] Synchronize the theme test through a real acknowledged Slider interaction, keeping full markup and computed-style assertions.
- [x] Reproduce sidebar drag: a complete gesture before code arrives loses movement/release outside the handle. Opt-in pointer capture runs in the loader; helper pointermove joins the event table. Fresh mouse/touch tests plus negative controls pass (runtime pointer/loader 15/15, UI theme/sidebar 12/12).
- [x] Reproduce `/kanban` fuzz: five `div.kanban__empty` server nodes were replaced at the first card click. Construct their JSX inside its owning child slot. Kanban 4/4 and the original 40-step fuzz pass with zero findings.
- [x] Diagnose `/tree-dnd`: server omitted the instruction description and `aria-describedby`, while client adoption added them. Tree now owns a hidden target in each row's gridcell, with row-derived IDs and the existing dynamic instruction wording. Optional internal metadata identifies its originating accessor so custom hooks' IDs and explicit `undefined` overrides remain intact. SSR and generic hook tests 4/4, full CDK 3253 (+2 skipped), CDK-dev 43/43, Tree production 3/3 and original unfiltered 40-step fuzz all pass. No comparison filters or pins added.

## Task 5: remaining cold and integration failures

- [x] Rerun the eight original failing examples on the current tree: Chromium/WebKit × touch × normal/throwing storage × early/idle = 64/64 pass. No current failure remains for a meaningful SSR-versus-CSR differential; the original Linux full-shard behavior still needs CI parity verification.
- [x] Check the touch menu's keyboard-focus expectation: collection pointerdown explicitly focuses an enabled item even for touch. The original action succeeds; later keyboard focus fails. This remains a supported behavior to investigate, not an invalid-test exemption.
- [x] Reproduce router source-add watcher, shell-cache bypass, DevTools HMR log, docs example adoption and TypeScript-plugin diagnostics failures; see dispositions below.
- [x] Rerun size drift before updating any baseline; baseline increases correspond to intended behavior changes. Final audit fixes require another measured baseline pass.

## Task 6: adversarial audit correctness defects

User fixture: `adversarial-lab/REPORT.uk.md`. Preserve its original source/results; do not rewrite its red assertions as passing.

- [x] `produce`: cached child drafts must not restore indices removed by `length`. Cover reads/edits, detached drafts, descriptor writes, regrowth holes, explicit reinsertion, sparse lengths, immutability, notification and structural sharing. Full reactivity prod/dev: 360/360. Independent differential check: 1,331 recipes, zero native-array mismatches.
- [x] Live pages: generate accessor props independently of navigate/forms and exclude live pages from the incompatible single-route fast path. Production native-link fixtures fail with HTTP 500 before the fix and pass for navigate=false/true afterward. Browser A/B additionally preserves the typed draft and original output node after a real native-link click. Full current router on Node 24: 420/420.
- [x] Correct public/internal fast-path documentation and regenerate llms/MCP outputs.
- [x] Classify `Async` subscription after SSR and page-handler/guard ordering as existing documented contracts. They are not changed or counted as fixed here. Untyped StorePath `length` probes and sparse reconciliation parity remain outside these two fixes.

## Other CI dispositions and open items

- Fixed shell-cache watchdog timing: arm when a deferred `.then` is consumed, not while the route module is still loading. Unit 9/9 and original dev-server probe pass.
- Fixed DevTools late adoption after resume disposal: pending `need()` continuations stop in development. Regression and full DevTools HMR 3/3 pass; this does not establish general cancellation of every async task.
- Fixed stale TS-plugin expectation: app JSX is resume-checked. Full 17/17; safe handler control retained.
- Drag-drop visible preload tests contradicted the existing M6 contract. Scrolling still fetches nothing; replacement tests hold a real cold native drag and assert preview, placeholder, drop order and node identity (7/7).
- Removed four stale known-red entries only after their original tests passed (drag-drop two, Resizable and Select). Four runtime/router timing entries remain.
- Source-add watcher and docs live-example adoption pass locally; original Linux CI conditions remain to be retested.
- Original cold CI had 15 failing touch cells across four mechanisms. Current fresh local matrix passes 64/64 with no skip/flaky/fixed exemptions; 7,960 relevant sources remained unchanged and peak tree RSS was 2,410 MiB. This does not identify an isolated fix or establish Linux full-shard parity. See the exact ledger below.
- Global format gate also scans the user's concurrently growing untracked audit result JSON. Those result files are unformatted; owned source changes pass the scoped checks (generated baselines follow their generator format). Preserve the fixture. Latest global run: 24 unformatted, all under `adversarial-lab/results/`.

## Verification ledger

Evidence is local; `.artifacts/` is intentionally untracked. Earlier red reports remain intact.

| Scope | Evidence | Result |
| --- | --- | --- |
| Integrated library suites | `.artifacts/stabilization/project-tests.json` | CDK 3249, CDK browser 3192, CDK components 514, language-core 58, router 416, TS plugin 17, UI 1438, DevTools 89 + dev 1 pass. Runtime prod/dev each has the existing first-click timing red. UI components 543 pass; axe failed on the scroll-shadow fitting fixture. Predates final Tree/live fixes. |
| Current audit state fix | `/private/tmp/rivet-produce-final.log` | Reactivity prod/dev 360/360. |
| Current router | `/private/tmp/rivet-ci-40906895437/router-after-live-full.log` | Node 24, 79 files, 420/420, including native-link production SSR + browser A/B. |
| Current Tree/CDK | `/private/tmp/rivet-tree-full-cdk.json`, `/private/tmp/rivet-tree-dnd-fuzz.jsonl` | CDK 3253 + dev 43 pass; Tree production 3/3. Original 40-step fuzz: zero findings, comparison remains active. |
| Current UI axe/scroll | `/private/tmp/rivet-ui-scroll-fitting-final.log` | Fresh strict axe over 318 pages plus 17 ScrollShadow cases: 18/18 pass. The controlled fitting fixture had a 24px line inside a forced 20px child. Removing that height prevents unintended overflow; regression checks fitting geometry and no added tab stop. The earlier axe red is resolved. |
| Current touch matrix | `apps/ui-docs/.artifacts/stabilization-cold-touch/cold.md` | Fresh shared eight-frame build, Node 24 macOS: 64/64, no skips/flakes, Chromium/WebKit × touch × normal/throws × early/idle. Original Linux shards built roughly 98 examples each; module grouping/loading and host differ. |
| Final affected types/metadata | `.artifacts/stabilization/final-types-metadata.json` | All other affected types + content/snippets/llms/errors/shards/MCP pass. CDK test authoring diagnostics were corrected afterward; final separate CDK gate passes (`final-cdk-typecheck.json`). Peak 2.92 GB. |
| Intermediate bytes after audit fixes | `.artifacts/stabilization/audit-fix-gates.json` | Types, frames, zero-cost + oracle 176/176, and size update/recheck pass, max 2.62 GB. Predates Tree; superseded by the final measurements below. |
| Final frames/zero-cost measurement | `.artifacts/stabilization/final-zero-frames.json` | After Tree changes: both gates pass, baselines unchanged from the measured intended deltas; oracle 176/176, max 2.28 GB. Standard CDK hash list covers masonry/flip/scheduler, not Tree/Resizable/Sidebar; separate same-path measurement below. |
| Production docs | `.artifacts/stabilization/final-docs-builds.json` | All three sites build; docs 64/64 and UI-docs suite pass, homepage byte metadata regenerated. Six gates, no new reds, max 2.48 GB. |
| Final byte/metadata check | `.artifacts/stabilization/final-verification.json` | Content/snippets/llms/MCP pass; zero-cost reports runtime + lanes identical, oracle 176/176. Size has only +10 B playground `/slots` HTML Brotli noise within the existing ±20 B tolerance. No new reds, max 2.51 GB. |

Intended byte costs before the final Tree change: loader +107 raw bytes (+36–51 Brotli by variant), independent `/store` entry +122 minified bytes, Kanban +8 minified bytes. Production DOM/reactivity entries remain identical; development disposal guard ships only in development. These are correctness costs, not a bundle-size reduction claim.

Final source snapshot: `.artifacts/stabilization/final-sources-before.json` records modified/new library TypeScript hashes once the fixes settled, before the final documentation builds and byte checks. `final-source-verification.json` confirms all 41 original hashes unchanged; the separately verified authentication conformance test is the only subsequent TypeScript addition.

CDK own-code measurement (`/private/tmp/rivet-cdk-own-code-cost.json`): archive HEAD into one temporary absolute path, measure with the existing `packages-hashes.mjs` export, overlay only the six changed production files, measure again. Tree DOM/server: +467/+335 minified bytes; Resizable +65/+62; Sidebar +19/+19. Fresh-process ordinary Tree SSR comparison finds one extra empty slot delimiter pair (+16 raw bytes per row, no extra element). This cost is recorded, not hidden by the standard gate's narrower entry list. Peak 529 MB; no source/baseline edits during measurement.

### Remaining touch ledger

All original failures use `touch/early`, paired `normal,throws` storage except menu-item-variants (normal only). All matching mouse cells passed. These are original-CI observations; current local 64-cell reproduction is entirely green.

| Engine | Examples | Original observation / next discriminating probe |
| --- | --- | --- |
| WebKit | autocomplete-indicator, autocomplete-virtualized, autocomplete-shorthand | Trigger opening fails (six cells). Trace direct trigger `onClick → toggleSelect`: zero or double toggles; do not assume focus alone explains a closed indicator. |
| WebKit | combo-box-shorthand, combo-box-virtualized | A visible option tap does not commit (four later cells); previous keyboard selection/filtering work. Trace pointerdown, cancellation, compatibility click and `memo.pressed` / node identity in selectable-item before blaming virtualization. |
| WebKit | input-group-default | Prefix tap leaves focus on body (two cold cells). Trace click delivery, `handleClick`, `input.focus()` and user activation. Runtime already emulates currentTarget. |
| Chromium | menu-standalone, menu-item-variants | Tap action succeeds; subsequent ArrowDown/ArrowUp does not focus the next item (three later cells). Trace focus through pointerdown, mousedown, click, and replay-default microtask. |

Reproduce each group with Node 24, replacing the example list and engine from the table:

```sh
node libs/docs-kit/cli.ts cold apps/ui-docs --frames --keep --only autocomplete-indicator,autocomplete-virtualized,autocomplete-shorthand --engines webkit --inputs touch --storage normal,throws --timing early,idle --out .artifacts/cold-open
```

Original logs: `/private/tmp/rivet-ci-40906895437/123564022659.clean:1453`, `123564023001.clean:1452`, `123564103987.clean:1488`, `123564118773.clean:1483`. Source review supports the asserted opening, commit and focus behavior; it establishes neither a font/storage cause nor a safe harness skip.

## Security follow-up

The user requested local defensive security verification after a separate chat hit a platform cyber filter. No filter settings or other thread were changed. See `docs/design/research/2026-10-29-security-verification.md` for scope and evidence.

- Fresh copied production fixture: 71/71, new SQLite database and ephemeral loopback port, original audit results preserved (`.artifacts/stabilization/security-validation.json`). Its layer labels distinguish 21 framework, 29 application and 21 mixed-policy checks.
- Focused framework security/hardening/cache/escaping verification: 55/55 on Node 24, including the new authentication-boundary conformance tests. Their actual kept-layout control proves loader skipping does not skip layout `onRequest`; valid controls prevent blanket-denial false positives.
- Public guide now explains shared session validation in `onRequest` before raw page handlers, plus resource-specific permission checks. Production request order is unchanged. Final router typecheck, docs build, site 64/64, content/snippets/llms/MCP all pass (`.artifacts/stabilization/security-docs-gates.json`, max 1.94 GB).
- No new exploitable framework defect was established by this scoped pass. Production configuration, exhaustive vulnerability analysis and whole-framework safety certification remain outside its evidence.

## Verification and acceptance

- [x] Every completed product fix has failure-before/pass-after evidence and nearest documentation updates.
- [x] Focused fresh production checks, affected suite verification and typechecks completed. The ledger preserves the earlier broad UI axe red, its passing correction and the existing runtime timing reds; this is not an all-green-suite claim.
- [x] Root ran `node scripts/gates/run.ts --list`, affected gates, zero-cost, size and frame measurements/checks. Intended byte increases and baseline noise are recorded above.
- [x] Review the combined diff for cross-agent conflicts, semantic weakening and edits to user work. Review caught and corrected explicit reinsertion of a detached draft; no remaining blocker in the reviewed fixes.
- [x] Record verified fixes separately from open failures and Linux parity work. A locally passing subset is not a green CI claim or production-readiness certification.

## Review focus

Cold first interaction; plain object and callback imperative refs; ref-free scheduling; delayed descendant adoption; server-node identity; pointer capture before release; keyboard versus touch focus; Linux/Node 24 environment parity; public diagnostics matching the documented resume model.
