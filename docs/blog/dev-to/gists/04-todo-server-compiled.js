// compile(todo.tsx, { target: "server" }) — verbatim compiler output.
// Static HTML is hoisted into frozen fragment arrays. The `.map` becomes a list plan + a tape writer.
// The onClick is gone: a plain server target has no browser.
import { compiledTemplate as __rivetTemplate, attribute as __rivetAttribute, _list as __rivetList, _listPlan as __rivetListPlan } from "@rivetjs/runtime/server";
const __rivetFragments0 = Object.freeze(["<li>", "</li>"]);
const __rivetFragments1 = Object.freeze([
	"<section",
	"><p>Done: ",
	"</p><ul>",
	"</ul><button>Mark one done</button></section>"
]);
const __rivetPlan1 = __rivetListPlan(__rivetFragments0, [null]);
import { signal } from "@rivetjs/reactivity";
export function TodoList(props) {
	const done = signal(0);
	return __rivetTemplate(__rivetFragments1, [
		__rivetAttribute("class", done() > 0 ? "busy" : "idle"),
		done(),
		__rivetList(props.items, (item) => __rivetTemplate(__rivetFragments0, [item.label]), __rivetPlan1, (__rivetTape, __rivetBase, item) => __rivetTape[__rivetBase] = item.label)
	]);
}
