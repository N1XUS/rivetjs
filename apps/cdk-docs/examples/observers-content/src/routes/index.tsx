import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { observeContent } from "@rivetjs/cdk/observers";

export const head = { title: "observeContent()" };

// #region demo
export default function Content() {
  const changes = signal(0);
  const batches = signal(0);
  let list!: HTMLUListElement;
  // Angular cdkObserveContent: a MutationObserver on text and children (subtree), comment-only
  // changes ignored. Each call returns its cleanup; the effect runs it when the component goes away.
  clientEffect(() => observeContent(list, () => changes.update((n) => n + 1)));
  clientEffect(() => observeContent(list, () => batches.update((n) => n + 1), { debounce: 1000 }));
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <div class="flex gap-2">
        <button
          id="add"
          type="button"
          class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
          onClick={() => list.append(Object.assign(list.ownerDocument.createElement("li"), { textContent: `Item ${list.children.length + 1}` }))}
        >
          Add item
        </button>
        <button
          id="comment"
          type="button"
          class="rounded-md border border-slate-300 px-3 py-1"
          onClick={() => list.append(list.ownerDocument.createComment("ignored"))}
        >
          Add a comment node
        </button>
      </div>
      <ul id="list" ref={(el) => (list = el)} class="list-disc ps-6">
        <li>Item 1</li>
      </ul>
      <p id="changes">Changes: {changes()}</p>
      <p id="batches">Debounced (1 s): {batches()}</p>
    </section>
  );
}
// #endregion
