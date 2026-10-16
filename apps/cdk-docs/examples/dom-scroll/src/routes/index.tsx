import { signal } from "@rivetjs/reactivity";
import { getActiveElement, getScrollParent, getViewportSize, isFocusWithin, isScrollable, nodeContains, scrollIntoView } from "@rivetjs/cdk/dom";

export const head = { title: "DOM helpers" };

const items = Array.from({ length: 30 }, (_, i) => `Item ${i + 1}`);

// #region demo
export default function Scrolling() {
  const report = signal<string[]>([]);
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <button
        id="go"
        type="button"
        class="justify-self-start rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
        onClick={(event) => {
          const doc = event.currentTarget.ownerDocument;
          const list = doc.getElementById("list")!;
          const target = doc.getElementById("item-25")!;
          // Scrolls only `list` (not the page), the least distance that shows the item.
          scrollIntoView(list, target);
          const box = list.getBoundingClientRect();
          const rect = target.getBoundingClientRect();
          report.set([
            `item 25 visible: ${rect.top >= box.top && rect.bottom <= box.bottom}`,
            `isScrollable(list): ${isScrollable(list)}`,
            `getScrollParent(item 25): #${getScrollParent(target).id}`,
            `nodeContains(list, item 25): ${nodeContains(list, target)}`,
            `getActiveElement(): #${getActiveElement(doc)?.id}`,
            `isFocusWithin(list): ${isFocusWithin(list)}`,
            `getViewportSize().width > 0: ${getViewportSize().width > 0}`,
          ]);
        }}
      >
        Scroll item 25 into view
      </button>
      <ul id="list" class="h-24 overflow-y-auto rounded border border-slate-300">
        {items.map((label, i) => (
          <li id={`item-${i + 1}`} class="px-2 py-0.5 odd:bg-slate-50">
            {label}
          </li>
        ))}
      </ul>
      <ul id="report" class="font-mono text-xs">
        {report().map((line) => (
          <li>{line}</li>
        ))}
      </ul>
    </section>
  );
}
// #endregion
