// The outside right-click closer of a "contextMenu" menu trigger (react-aria useContextMenu: the document
// `mousedown` listener lives while the menu is open). Rivet adds it per open; it must not outlive the menu.
import { installDom } from "./install-dom.ts";
installDom();
import { describe, expect, it, vi } from "vitest";
import { menuTriggerContextMenuOpen } from "../menu/behaviour.tsx";
import { closeMenu, createMenuTriggerState } from "../state/menu.ts";

describe("context menu outside closer", () => {
  it("right click on the body closes the open menu", () => {
    const state = createMenuTriggerState();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    menuTriggerContextMenuOpen(trigger, 1, 1, state);
    expect(state.isOpen()).toBe(true);
    document.body.dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true }));
    expect(state.isOpen()).toBe(false);
    trigger.remove();
  });

  it("the document listener is released once the menu closed (no listener per closed trigger)", () => {
    const state = createMenuTriggerState();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const remove = vi.spyOn(document, "removeEventListener");
    try {
      menuTriggerContextMenuOpen(trigger, 1, 1, state);
      closeMenu(state);
      document.body.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true }));
      expect(remove.mock.calls.filter(([type]) => type === "mousedown")).toHaveLength(1);
    } finally {
      remove.mockRestore();
      trigger.remove();
    }
  });
});
