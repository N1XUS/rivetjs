import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installDom } from "./install-dom.ts";
import type { DraggableCollectionState } from "../state/draggable-collection.ts";

const dom = installDom();
const { useDrag } = await import("../dnd/use-drag.ts");
const { useDraggableItem } = await import("../dnd/use-draggable-item.ts");
const { setInteractionModality } = await import("../interactions/focus-visible.tsx");

beforeEach(() => {
  dom.reset();
  setInteractionModality("virtual");
});
afterEach(() => vi.restoreAllMocks());

describe("drag instructions", () => {
  it("keeps standalone hook description targets and modality wording", () => {
    const drag = useDrag({ getItems: () => [{ "text/plain": "Document" }], locale: "en-US" });
    for (const [modality, text] of [
      ["virtual", "Click to start dragging."],
      ["keyboard", "Press Enter to start dragging."],
    ] as const) {
      setInteractionModality(modality);
      const id = drag.dragProps["aria-describedby"]!();
      expect(document.getElementById(id!)?.textContent).toBe(text);
      expect(drag._description?.()).toBe(text);
    }
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    setInteractionModality("virtual");
    const id = drag.dragProps["aria-describedby"]!();
    expect(document.getElementById(id!)?.textContent).toBe("Double tap to start dragging.");
  });

  it("leaves disabled standalone hooks without drag instructions", () => {
    const drag = useDrag({ getItems: () => [], isDisabled: true, locale: "en-US" });
    expect(drag.dragProps).toEqual({ draggable: "false" });
    expect(drag.dragButtonProps).toEqual({});
    expect(drag._description?.()).toBeUndefined();
    expect(document.body.children).toHaveLength(0);
  });

  it("preserves selected-item instructions and explicit drag button labels", () => {
    let disabled = false;
    const state = {
      getItems: () => [{ "text/plain": "Document" }],
      getKeysForDrag: () => new Set(["document", "photo"]),
      selectionManager: { selectionMode: "multiple", isSelected: () => true, isDisabled: () => disabled },
      collection: { getTextValue: () => "Document" },
    } as unknown as DraggableCollectionState;
    const row = useDraggableItem({ key: "document", hasAction: true, locale: "en-US" }, state);
    setInteractionModality("keyboard");
    expect(row._description?.text()).toBe("Press Alt + Enter to drag 2 selected items.");
    const id = row.dragProps["aria-describedby"]!();
    expect(document.getElementById(id!)?.textContent).toBe(row._description?.text());
    const button = useDraggableItem({ key: "document", hasDragButton: true, locale: "en-US" }, state);
    expect((button.dragButtonProps["aria-label"] as () => string)()).toBe("Drag 2 selected items");
    expect(button._description?.text()).toBe("Press Enter to start dragging.");
    disabled = true;
    expect(row._description?.text()).toBeUndefined();
    expect(button._description?.text()).toBeUndefined();
  });
});
