// compile(todo.tsx, { target: "dom", domV2: true }) — verbatim compiler output.
// One <template> per static tree, cloned per call; nodes found by firstChild/nextSibling walks;
// one effect per dynamic binding; the click is delegated (handler lives on the node).
import { _tpl as __rivet_tpl, _on as __rivet_on, _insert as __rivet_insert, _fx as __rivet_fx, _cls as __rivet_cls, _t as __rivet_t } from "@rivetjs/runtime/dom";
const __rivetTpl0 = /* @__PURE__ */ __rivet_tpl("<li>");
const __rivetTpl1 = /* @__PURE__ */ __rivet_tpl("<section><p>Done: </p><ul></ul><button>Mark one done");
import { signal } from "@rivetjs/reactivity";
export function TodoList(props) {
	const done = signal(0);
	{
		const _el$1 = __rivetTpl1(), _el$2 = _el$1.firstChild, _el$4 = _el$2.nextSibling, _el$5 = _el$4.nextSibling;
		__rivet_fx(() => __rivet_cls(_el$1, done() > 0 ? "busy" : "idle"));
		__rivet_insert(_el$2, () => done(), null);
		__rivet_fx(() => {
			try {
				__rivet_t(_el$4, props.items.map((item) => {
					const _el$3 = __rivetTpl0();
					__rivet_fx(() => {
						try {
							__rivet_t(_el$3, item.label);
						} catch (__rivetError) {
							__rivet_t(_el$3, null);
							throw __rivetError;
						}
					});
					return _el$3;
				}));
			} catch (__rivetError_) {
				__rivet_t(_el$4, null);
				throw __rivetError_;
			}
		});
		__rivet_on(_el$5, "click", () => done.update((n) => n + 1));
		return _el$1;
	}
}
