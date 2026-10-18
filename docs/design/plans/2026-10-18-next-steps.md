# Next steps after 2026-10-18 (branch `claude/amazing-knuth-driu2f`, head `8b74865` = labelled WIP)

Read `docs/design/plans/2026-10-18-derived-client.md` (the plan) and `docs/benchmarks/2026-10-12-route-chunks.md` "Follow-up" (the numbers) first.

## State

- Landed and verified: placed-parts route mode + merge policy (`libs/compiler/vite.ts`, `chunk-groups.ts`), the filter keystroke fix (`63d0e49`), origin zstd + encoded harness (`862805e`, M5 E1/E2 done).
- In `8b74865` (WIP, not release-ready): the default switch to `chunks: "route"` / `merge: 65536` with docs, tests and re-baselined zero-cost / size report (suites green); dom-resume `arm` falsy-value fix (verified); dom-resume blur/focus region-defer fix — **rejected by the resume fuzz** (6 cdk + 1 ui routes, 3/3 reproducible: a deferred `keep` refocus fires outside the user event, cdk focus-visible reads it as keyboard focus). M2 lane A partial (`model: "derived"`: `libs/runtime/server-derived.ts`, facts fixpoint, diagnostics); its Rust patches were only in the container's untracked patch queue and are lost — redo from the M2 section of the plan.

## Do next, in order

1. Redesign the blur fix in `libs/runtime/dom-resume.ts` `activate`: region re-creation stays synchronous inside the user event (no timers); instead, when a delegated or cold-replayed focus-change event (`blur` / `focusout` / `change`) targets an element the re-creation detached, retarget it to the `keep` replacement so `@rivetjs/forms` `onBlur` resolves the field. Keep `resume-blur-region-browser.test.ts` (adapt), add a fuzz-shaped regression test (a resumed cdk Tooltip trigger click gets no `aria-describedby`). Rerun the 7 fuzz routes ×3 (`RIVET_FUZZ_ROUTES='/^\/(dom-events-forms|dom-events-overlays|render-resumed|selection-indicator-groups|tag-group|tooltip|number-field)$/' npx vitest run --project cdk-resume-fuzz --maxWorkers=1`; ui `/^\/forms$/`), then the full cdk and ui fuzz (one at a time). `/number-field`'s `test.fails` pin must fail again. `/selection-indicator-groups` (`title=""` on resumed radio inputs) may be a separate, older cause: check against a HEAD build.
2. Only then: re-baseline (`sh scripts/zero-cost/check.sh --update`, `npm run size-report -- --update`), write the M1 T4 status line in the plan, commit as the real landing (message template in the session's landing report: subject "chunks: route is the default (merge 65536); two resume runtime fixes it exposed").
3. M5 E3 dictionary transport (per-route dictionary = the route chunk; `Use-As-Dictionary` / `Available-Dictionary`, `dcz` encoding in the node adapter; manifest field from `vite.ts` `generateBundle`).
4. M2 adopted layer: restart lane A (compiler patches C1/C2 as queued diffs + R1 recorder), then C3 / R2–R5 per the plan. The compiler wasm builds in a cloud container through Docker only with the proxy and CA passed in and host networking (`docker run --network host -e HTTPS_PROXY -e SSL_CERT_FILE=/ca.crt -v /root/.ccr/ca-bundle.crt:/ca.crt:ro …`); the image is `rust:1.85.1-bookworm`; the build is not byte-reproducible with the committed wasm (no wasm-opt in the image).
5. Gate ruling still open for the user: the original M1 gate (≤ 5 files) is unreachable with singleton modules; the proposed revised gate (≤ 25 widget / ≤ 45 dashboard files at ≤ +30 % bytes through the first click, click +0) is met by route + 64 K.

## Container notes

Node 24 at `/opt/node24/package/bin`; Playwright's headless shell is aliased to the installed Chromium 141 (`/opt/pw-browsers/chromium_headless_shell-1243` → chromium-1194); `pkill -f` / `pgrep -f` with a pattern in your own command kills your shell; Chromium launch needs `--use-mock-keychain --password-store=basic`; the resume-bench `--build` + probes run here (`apps/resume-bench/spikes/frames-probe.ts`).
