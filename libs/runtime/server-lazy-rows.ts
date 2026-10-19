// Lazy collection rows, T1 measurement harness (spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md §3.4,
// ruling R2): the `swap` interim — a bytes / server-CPU baseline that must NEVER ship. `_lazyRowsSwap()` is called
// only by the router's generated server entry under `RIVET_LAZY_ROWS=swap` (`@rivetjs/router` `build/lazy-rows.ts`:
// dev server or the lazy-rows tools' builds). No package export, no runtime entry imports it: production bundles and
// the zero-cost hashes do not contain it.
//
// Every For row rendered while a resume recorder runs renders unrecorded (`_rUnrecorded`: no `data-r`, handlers,
// bindings, captures or row records inside it) and the For's enclosing region gets the `interaction` mount trigger
// (the client-only mount mechanism): the first pointerdown / keydown re-creates the region in the browser — create +
// swap, the `recreated` class of the resume fuzz (event target replaced under the pointer, input values and focus lost).
// Replaces server-resume's row hook (imported first, so its `_onForRow` already ran); no runtime source changes,
// so the zero-cost lanes stay byte-identical. Rows keep markers the measurement tools read (`<!--L-->` before a For's first row, `<!--l-->` before each row:
// docs-kit `tools/rows.ts` reports them as `lazy`). Uniform rows skip their row plan (`_onForRows`) so they take the
// same path.
//
// Known gaps (measurement only): a For with no enclosing region scope (streamed `Async` content, a held scope) gets
// dead rows (no region re-creates them); every For counts as eligible — the compiler's per-For eligibility facts (T2)
// are not read yet.
import { _rUnrecorded } from "./resume-format.ts";
import { _rReset } from "./server-resume.ts";
import { clientOnly } from "./server-async.ts";
import { compiledTemplate } from "./server.ts";
import type { ServerValue } from "./server.ts";
import { CONSTANT, _onForRow, _onForRows } from "./server-structural.ts";
import type { ConstantGetter } from "./server-structural.ts";

let installed = false;
/** @internal Install the swap row hook (idempotent). Called first by the server entry in swap mode. */
export function _lazyRowsSwap(): void {
  if (installed) return;
  installed = true;
  // The trigger: a client-only mount at `interaction` marks the nearest region (rows / branches are skipped).
  const trigger = clientOnly(() => ({ default: () => null }), undefined, { when: "interaction" }) as (props: object) => ServerValue;
  const started = new WeakSet<object>();
  _onForRows(() => undefined);
  _onForRow((list, item, _key, index, render) => {
    const get: ConstantGetter<unknown> = () => item;
    get[CONSTANT] = item;
    const at: ConstantGetter<number> = () => index;
    at[CONSTANT] = index;
    // No recorder (plain render, or inside another lazy row): what server-resume's row hook does then.
    if (_rReset() === null) return render(get, at);
    trigger({});
    const first = !started.has(list);
    if (first) started.add(list);
    return compiledTemplate(first ? FIRST : NEXT, [_rUnrecorded(() => render(get, at))]);
  });
}

const FIRST = Object.freeze(["<!--L--><!--l-->", ""]),
  NEXT = Object.freeze(["<!--l-->", ""]);
