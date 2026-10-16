// Ported from react-aria test/disclosure/useDisclosure.test.ts, Apache-2.0, © Adobe.
// Rivet: renderHook → `disclosureProps(props, state)`; the panel's `hidden` binding is applied by an
// `effect` (the role of the runtime attribute binding); `ref` → `panelRef` accessor of the panel element.
import { installDom } from "./install-dom.ts";
const dom = installDom();
import { afterEach, describe, expect, it, vi } from "vitest";
import { effect, signal } from "@rivetjs/reactivity";
import type { PressEvent } from "../interactions/press.tsx";
import { disclosureProps, disclosurePanelBeforeMatch, disclosurePanelStyle } from "../disclosure/behaviour.tsx";
import { createDisclosureState, type DisclosureProps } from "../state/disclosure.ts";

const press = (e: Partial<PressEvent>) => e as PressEvent;

/** A panel element bound like the component binds it. */
function mount(stateProps: DisclosureProps, props: { isDisabled?: boolean } = {}) {
  const state = createDisclosureState(stateProps);
  const panel = document.createElement("div");
  const aria = disclosureProps({ id: "d", panelRef: () => panel, ...props }, state);
  panel.id = aria.panelProps.id;
  document.body.append(panel);
  const stop = effect(() => {
    const value = aria.panelProps.hidden();
    if (value === undefined) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", value);
  });
  return { state, aria, panel, stop };
}

describe("useDisclosure", () => {
  afterEach(() => {
    dom.reset();
    vi.clearAllMocks();
  });

  it("should return correct aria attributes when collapsed", () => {
    const { aria } = mount({});
    expect(aria.buttonProps["aria-expanded"]()).toBe(false);
    expect(aria.panelProps["aria-hidden"]()).toBe(true);
  });

  it("should return correct aria attributes when expanded", () => {
    const { aria } = mount({ defaultExpanded: true });
    expect(aria.buttonProps["aria-expanded"]()).toBe(true);
    expect(aria.panelProps["aria-hidden"]()).toBe(false);
  });

  it("should handle expanding on press event (with mouse)", () => {
    const { aria, state } = mount({});
    aria.buttonProps.onPress(press({ pointerType: "mouse" }));
    expect(state.isExpanded()).toBe(true);
  });

  it("should handle expanding on press start event (with keyboard)", () => {
    const { aria, state } = mount({});
    aria.buttonProps.onPressStart(press({ pointerType: "keyboard" }));
    expect(state.isExpanded()).toBe(true);
  });

  it("should not toggle when disabled", () => {
    const { aria, state } = mount({}, { isDisabled: true });
    aria.buttonProps.onPress(press({ pointerType: "mouse" }));
    expect(state.isExpanded()).toBe(false);
  });

  it("should keep panel hidden when toggling disabled state", () => {
    // Rivet: `isDisabled` is a render-time prop (a new render = new props); the panel stays hidden either way.
    const { panel } = mount({}, { isDisabled: true });
    expect(panel.hidden).toBe(true);
    const again = mount({}, { isDisabled: false });
    expect(again.panel.hidden).toBe(true);
  });

  it("should set correct IDs for accessibility", () => {
    const { aria } = mount({});
    expect(aria.buttonProps["aria-controls"]).toBe(aria.panelProps.id);
    expect(aria.panelProps["aria-labelledby"]).toBe(aria.buttonProps.id);
  });

  it("should expand when beforematch event occurs", () => {
    const { state, panel } = mount({});
    panel.addEventListener("beforematch", (e) => disclosurePanelBeforeMatch(e, { id: "d" }, state));
    expect(state.isExpanded()).toBe(false);
    expect(panel.getAttribute("hidden")).toBe("until-found");
    panel.dispatchEvent(new Event("beforematch", { bubbles: true }));
    expect(state.isExpanded()).toBe(true);
    expect(panel.hasAttribute("hidden")).toBe(false);
  });

  it("should not expand when beforematch event occurs if controlled and closed", () => {
    const onExpandedChange = vi.fn();
    const { state, panel } = mount({ isExpanded: false, onExpandedChange });
    panel.addEventListener("beforematch", (e) => disclosurePanelBeforeMatch(e, { id: "d" }, state));
    expect(state.isExpanded()).toBe(false);
    expect(panel.getAttribute("hidden")).toBe("until-found");
    panel.dispatchEvent(new Event("beforematch", { bubbles: true }));
    expect(state.isExpanded()).toBe(false);
    expect(panel.getAttribute("hidden")).toBe("until-found");
    expect(onExpandedChange).toHaveBeenCalledTimes(1);
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  // Rivet additions.
  it("sets the size variables on change (px while animating, then auto / hidden)", async () => {
    const isExpanded = signal(false);
    const { panel } = mount({ isExpanded });
    isExpanded.set(true);
    expect(panel.hasAttribute("hidden")).toBe(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(panel.style.getPropertyValue("--disclosure-panel-height")).toBe("auto");
    isExpanded.set(false);
    expect(panel.style.getPropertyValue("--disclosure-panel-height")).toBe("0px");
    expect(panel.getAttribute("hidden")).toBe("until-found");
  });

  it("server style carries the initial size variables", () => {
    expect(disclosurePanelStyle(true)).toContain("--disclosure-panel-height:auto");
    expect(disclosurePanelStyle(false)).toContain("--disclosure-panel-height:0px");
  });
});
