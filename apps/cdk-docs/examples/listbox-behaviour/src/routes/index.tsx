import { For } from "@rivetjs/runtime/dom";
import { createListState } from "@rivetjs/cdk/collections/list-state";
import type { Selection } from "@rivetjs/cdk/collections/types";
import {
  createListData,
  listBoxClick,
  listBoxFocusIn,
  listBoxFocusOut,
  listBoxKeyDown,
  listBoxKeyUp,
  listBoxMouseDown,
  listBoxPointerDown,
  listBoxPointerUp,
  listBoxProps,
  optionProps,
} from "@rivetjs/cdk/listbox/behaviour";

export const head = { title: "ListBox behaviour on your own markup" };

const tags = [
  { key: "bug", label: "bug" },
  { key: "docs", label: "docs" },
  { key: "perf", label: "perf", disabled: true },
  { key: "ui", label: "ui" },
];

const show = (keys: Selection) => (keys === "all" ? "all" : [...keys].map(String).sort().join(", ") || "none");

// #region demo
export default function Tags() {
  // useListState → createListState (selection + focus as signals); the rendered options are the collection.
  const state = createListState({ id: "tags", selectionMode: "multiple", disabledKeys: tags.filter((t) => t.disabled).map((t) => t.key) });
  // useListBox → listBoxProps (attributes) + the listBox<Event> handlers wired on the element.
  const data = createListData({ "aria-label": "Labels" }, "tags");
  const behaviour = { data, orientation: "horizontal" as const };
  const list = listBoxProps({ "aria-label": "Labels", orientation: "horizontal" }, state, data).listBoxProps;
  const tabIndex = list.tabIndex as () => number | undefined;
  return (
    <section class="m-4 grid gap-2 text-sm">
      <ul
        id="tags"
        role="listbox"
        data-collection="tags"
        aria-label="Labels"
        aria-orientation="horizontal"
        aria-multiselectable="true"
        tabIndex={tabIndex()}
        class="m-0 flex list-none gap-1 p-0"
        onKeyDown={(e: KeyboardEvent) => listBoxKeyDown(e as never, behaviour, state)}
        onKeyUp={(e: KeyboardEvent) => listBoxKeyUp(e as never, behaviour, state)}
        onPointerDown={(e: PointerEvent) => listBoxPointerDown(e as never, behaviour, state)}
        onPointerUp={(e: PointerEvent) => listBoxPointerUp(e as never, behaviour, state)}
        onClick={(e: MouseEvent) => listBoxClick(e as never, behaviour, state)}
        onMouseDown={(e: MouseEvent) => listBoxMouseDown(e as never, behaviour, state)}
        onFocusIn={(e: FocusEvent) => listBoxFocusIn(e as never, behaviour, state)}
        onFocusOut={(e: FocusEvent) => listBoxFocusOut(e as never, behaviour, state)}
      >
        <For each={() => tags} by={(tag) => tag.key}>
          {(tag) => {
            // useOption → optionProps: attribute accessors, bound below.
            const option = optionProps({ key: tag().key }, state, data);
            const attrs = option.optionProps;
            const ariaSelected = attrs["aria-selected"] as () => string | undefined;
            const ariaDisabled = attrs["aria-disabled"] as () => string | undefined;
            const optionTabIndex = attrs.tabIndex as () => number | undefined;
            return (
              <li
                id={attrs.id as string}
                role="option"
                data-key={tag().key}
                data-collection="tags"
                aria-selected={ariaSelected()}
                aria-disabled={ariaDisabled()}
                tabIndex={optionTabIndex()}
                class="rounded-full border border-slate-300 px-3 py-0.5 outline-none aria-disabled:opacity-40 aria-selected:border-teal-700 aria-selected:bg-teal-700 aria-selected:text-white focus-visible:ring-2"
              >
                {tag().label}
              </li>
            );
          }}
        </For>
      </ul>
      <p id="tags-value" class="text-slate-600">
        Labels: {show(state.selectionState.selectedKeys())}
      </p>
    </section>
  );
}
// #endregion
