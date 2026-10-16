// Regression: a resumed page's document listener (capture, installed at boot) runs before the lazily
// installed focus-visible listeners, so the menu trigger's keydown must record its own modality. A
// programmatically focused trigger ("virtual") opened with Enter otherwise kept "virtual": the menu's
// autoFocus was deferred to after the popover's own focus and the item never got focus.
import { installDom } from "./install-dom.ts";
installDom();
import { afterEach, describe, expect, it } from "vitest";
import { menuTriggerKeyDown } from "../menu/behaviour.tsx";
import { createMenuTriggerState } from "../state/menu.ts";
import { _setInteractionModality, getInteractionModality } from "../interactions/focus-visible.tsx";

describe("menuTriggerKeyDown modality", () => {
  afterEach(() => _setInteractionModality(null));

  it("an opening key makes the modality keyboard before the menu opens", () => {
    const state = createMenuTriggerState();
    _setInteractionModality("virtual");
    const e = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    expect(menuTriggerKeyDown(e, {}, state)).toBe(true);
    expect(getInteractionModality()).toBe("keyboard");
    expect(state.isOpen()).toBe(true);
    expect(state.focusStrategy()).toBe("first");
  });

  it("keys that do not open leave the modality alone", () => {
    const state = createMenuTriggerState();
    _setInteractionModality("virtual");
    expect(menuTriggerKeyDown(new KeyboardEvent("keydown", { key: "a" }), {}, state)).toBe(false);
    expect(getInteractionModality()).toBe("virtual");
  });
});
