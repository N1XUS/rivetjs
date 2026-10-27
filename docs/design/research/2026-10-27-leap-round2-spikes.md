# LEAP round 2: spike results (2026-10-27)

Three one-day spikes from the LEAP round-2 proposal (runtime-first leaps), each with fixed kill criteria set before the work. All three were killed. Spike code was throwaway and is not in the repo.

## 1. Planned structural resume recorder — KILL

- Idea: compiler-emitted recording plan fills column arrays per planned boundary id instead of generic `Boundary` objects / maps / scans in `libs/runtime/server-derived.ts`.
- Spike: hand-attached plan on the ssr-bench `/resume` page + TS `createPlannedDerived(plan)`; HTML byte-identical, strict validation + Chromium resume probe pass.
- Result: render CPU −17 % at 1,000 and 5,000 rows; unsafe verify-nothing ceiling −19 % / −21 %. HTTP CPU/req −11..−15 % (c1), −6..−19 % (c10); peak RSS best −8 %.
- Kill line: CPU ≥ 30 %, RSS ≥ 20 %. Both missed.
- Why: recorder state on that page is already fixed-size (4 boundaries, one DOM-data entry); the per-row work a plan removes is three verification walks (route-data `isData`, DOM-data checker, `admit` over the list tape). The rest of the gap to static is extra markup and emitting it.

## 2. Event-first micro-residuals — KILL at census

- Idea: a boundary's first event runs a tiny compiler-generated program over serialized signals + known DOM edit sites (set / toggle / counter), no adoption.
- Census (TS analysis over built example frames): 8 of 1,145 scripted first interactions eligible = 0.70 % (≤ 0.96 % counting unresolved selectors; ≤ 3.67 % even allowing component handlers and captured values as constants). docs 7/29, cdk-docs 1/591, ui-docs 0/525.
- Kill line: ≥ 5 % eligible. Rejections: calls into library helpers, signals passed to component props (`Show`, `Calendar`, `Select`, …), structural branches.

## 3. Indexed list-reactivity arena — KILL

- Idea: structure-of-arrays storage for homogeneous `For` rows (packed key / value / index / owner / signal slots, integer edges).
- Result (5,000 krausest-shape rows): JS heap −21.3 % (698 → 549 B/row), total page memory −1.6 %; update1 / update100 +14 % (2 runs); mount flat; swap −12..−18 %. Official large-DOM bench: 0 % (rows' Field components sit under a compiler `_fx` effect, arena never engaged). Resume-bench adopted rows neutral. No leaks.
- Kill line: heap ≥ 30 %, updates ≤ +10 %. Both missed; estimated arena-only ceiling ≈ −27 %.

## Takeaways

- Derived SSR cost above the static floor is markup + emit, not recorder bookkeeping: next SSR wins come from emitting less (DOM-readable values, smaller records), not from a faster recorder.
- Cheap first-event paths need ui / cdk handlers that are closed over data; library-helper calls and signal-to-component-prop flows dominate real handlers.
- Row heap is dominated by per-row component effects, not row bookkeeping.
