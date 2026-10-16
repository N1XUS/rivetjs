// Regression: a section's nested rows are rendered behind `view().children.length ? … : null`. The branch
// re-ran on every layout pass (each pass makes new view objects), re-creating the nested rows: on a resumed
// page their server bindings were left on removed elements ("Missing resumable element", docs example
// virtualizer-sections). The branch now depends on a computed boolean: rows survive scrolling.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { signal } from "@rivetjs/reactivity";
import { ListLayout, Virtualizer } from "../virtualizer/index.tsx";
import { driverOf, initialWindow, viewOf, type VirtualView, type VirtualizerModel } from "../virtualizer/behaviour.ts";

interface Entry {
  key: string;
  type: "section" | "header" | "item";
  label: string;
  children?: Entry[];
}

const groups: Entry[] = "ABCD".split("").map((letter) => ({
  key: letter,
  type: "section",
  label: `Group ${letter}`,
  children: [
    { key: `${letter}-header`, type: "header", label: `Group ${letter}` },
    ...Array.from({ length: 20 }, (_, i): Entry => ({ key: `${letter}-${i}`, type: "item", label: `${letter} person ${i}` })),
  ],
}));

const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

describe("Virtualizer sections", () => {
  afterEach(() => cleanup());

  it("keeps a section's nested rows across a scroll (no re-created branch)", async () => {
    const { container } = render(() => (
      <Virtualizer
        id="people"
        label="People"
        items={groups}
        layout={() => new ListLayout()}
        layoutOptions={{ rowSize: 32, headingSize: 28 }}
        initialSize={{ width: 320, height: 240 }}
        style={{ width: "320px", height: "240px" }}
      >
        {(entry, view) => (view().type === "section" ? null : <div class="row">{(entry() as Entry).label}</div>)}
      </Virtualizer>
    ));
    await frame();
    const row = container.querySelector('[data-rv-view="A-0"]');
    expect(row).not.toBeNull();
    const scroller = container.querySelector<HTMLElement>("#people")!;
    scroller.scrollTop = 40;
    scroller.dispatchEvent(new Event("scroll"));
    await frame();
    expect(scroller.scrollTop).toBe(40);
    // Same element: the row was updated in place, not re-created by its parent's branch.
    expect(container.querySelector('[data-rv-view="A-0"]')).toBe(row);
  });

  // Regression (docs example virtualizer-sections): on a resumed page no row accessor ran before the driver's
  // first projection (first scroll / click), so a row leaving the window found no descriptor in viewOf's cache
  // ("Cannot read properties of undefined (reading 'type')"). The replaced (server) views now seed it.
  it("a row removed by the first projection still reads its server descriptor (resumed page)", async () => {
    const el = document.createElement("div");
    el.id = "people-resumed";
    el.style.cssText = "width:320px;height:240px;overflow:auto";
    document.body.append(el);
    const model: VirtualizerModel<Entry, unknown> = {
      id: el.id,
      items: groups,
      layout: () => new ListLayout() as never,
      layoutOptions: { rowSize: 32, headingSize: 28 },
      collection: {},
      initialSize: { width: 320, height: 240 },
      loadMoreOffset: 1,
      shouldObserveItemSize: false,
      persistedKeys: [],
      focusedKey: signal<string | number | null>(null),
      views: signal<VirtualView<Entry>[]>([]),
      contentSize: signal({ width: 0, height: 0 }),
      isScrolling: signal(false),
    };
    // The server window, as resumed: rows exist, but viewOf never ran for them.
    const first = initialWindow(model);
    model.views.set(first.views);
    model.contentSize.set(first.contentSize);
    const spacer = document.createElement("div");
    spacer.style.height = first.contentSize.height + "px";
    el.append(spacer);
    el.scrollTop = 2000;
    try {
      driverOf(model, el);
      await frame();
      expect(model.views().some((view) => view.key === "A")).toBe(false);
      // The removed section and its nested row keep their last (server) descriptors.
      expect(viewOf(model, model.views(), "A").type).toBe("section");
      expect(viewOf(model, [], "A-0").type).toBe("item");
    } finally {
      el.remove();
    }
  });
});
