import { ref } from "@rivetjs/runtime/dom";
import { createFocusManager } from "@rivetjs/cdk/focus";

export const head = { title: "createFocusManager" };

const cards = [
  { id: "c1", title: "Inbox" },
  { id: "c2", title: "Drafts" },
  { id: "c3", title: "Old", archived: true },
  { id: "c4", title: "Sent" },
];

// #region demo
export default function Cards() {
  const grid = ref<HTMLDivElement>();
  const onKeyDown = (e: KeyboardEvent) => {
    // Created in the handler (browser only); options are defaults for every call.
    const manager = createFocusManager(grid, { wrap: true, accept: (el) => !el.hasAttribute("data-archived") });
    if (e.key === "ArrowRight") manager.focusNext();
    else if (e.key === "ArrowLeft") manager.focusPrevious();
    else return;
    e.preventDefault();
  };
  return (
    <div ref={grid} class="m-4 flex gap-2 text-sm" onKeyDown={onKeyDown}>
      {cards.map((card) => (
        <button
          id={card.id}
          type="button"
          data-archived={card.archived ? "" : undefined}
          class="rounded border border-slate-300 px-3 py-2 data-[archived]:opacity-50"
        >
          {card.title}
        </button>
      ))}
    </div>
  );
}
// #endregion
