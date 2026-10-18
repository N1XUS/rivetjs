// Same todo.tsx compiled for the RESUMABLE server target — verbatim.
// Every binding that reads a signal becomes a recorded site with a symbol id ("file#Component$n")
// and its captures. The onClick survives as `_rOn("click", symbol, [done])`: no function is shipped,
// only its address and the values it closed over.
import { compiledTemplate as __rivetTemplate, _list as __rivetList, _listPlan as __rivetListPlan } from "@rivetjs/runtime/server";
import { _rAttr as __rivetR_attr, _rId as __rivetR_id, _rBind as __rivetR_bind, _rOn as __rivetR_on } from "@rivetjs/runtime/server-resume";
const __rivetFragments0 = Object.freeze(["<li>", "</li>"]);
const __rivetFragments1 = Object.freeze([
	"<section",
	"",
	"><p>Done: ",
	"</p><ul>",
	"</ul><button",
	"",
	">Mark one done</button></section>"
]);
const __rivetPlan1 = __rivetListPlan(__rivetFragments0, [null]);
import { signal } from "@rivetjs/reactivity";
export function TodoList(props) {
	const done = signal(0);
	return __rivetTemplate(__rivetFragments1, [
		__rivetR_attr("class", "src/todo.tsx#TodoList$0", () => done() > 0 ? "busy" : "idle", [done]),
		__rivetR_id(),
		__rivetR_bind("src/todo.tsx#TodoList$1", () => done(), [done]),
		__rivetR_bind("src/todo.tsx#TodoList$2", () => __rivetList(props.items, (item) => __rivetTemplate(__rivetFragments0, [item.label]), __rivetPlan1, (__rivetTape, __rivetBase, item) => __rivetTape[__rivetBase] = item.label), [props]),
		__rivetR_on("click", "src/todo.tsx#TodoList$3", [done]),
		__rivetR_id()
	]);
}
