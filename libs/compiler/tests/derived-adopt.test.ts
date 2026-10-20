// Derived model, DOM target adopt mode (M2 C3, plan docs/design/plans/2026-10-18-derived-client.md, spec
// docs/design/specs/2026-10-18-structural-resume-design.md §3.5): not implemented. The DOM target is unchanged by
// `resume: { model: "derived" }` (derived-target.test.ts pins that). Skeleton of the contract C3 has to meet; each case
// lands with its ABI name added to spec §3.3 / §3.5 first (coordinated with the runtime lane R3, `dom-adopt`).
import { test } from "vitest";

// Same function, runtime flag: the `_tpl` clone becomes a walk over the live server nodes (no second compile output).
test.todo("adopt mode: one DOM function per component; the template clone switches to a walk over the server nodes by a runtime flag");
// Keys must equal the server target's (`<h5>-<n>` over the module, `resume/derived.rs` `plan`): one plan for both targets.
test.todo("keyed state on the DOM target: signal(x) → _sig(key, x) / createStore(x) → _sigStore(key, x), keys identical to the server target");
test.todo("static-dep bindings: a text / attribute binding reading only this body's keyed signals lowers to _fxLazy([signals], el, writer)");
test.todo("other bindings evaluate once on adoption (adopt-only compare against the live node)");
test.todo("content slots: _insert adopts the <!--[-->…<!--]--> pair the server wrote (structural or non-sole slots); sole text adopts the text node");
test.todo("For: adopt rows by their markers, lazy row functions (run on event / wake / reconcile)");
test.todo("Show / Switch: adopt the server branch by its marker; the condition is a stub on its static deps or evaluates once");
test.todo("component calls: dependent child runs now; independent child (build verdict) → _defer(Child, props) against its data-b boundary");
test.todo("serialized model and plain DOM compiles stay byte-identical (parity, zero-cost)");
