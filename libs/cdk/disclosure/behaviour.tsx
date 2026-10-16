// Ported from react-aria disclosure/useDisclosure.ts (packages/react-aria/src/disclosure), Apache-2.0, © Adobe.
//
// Rivet:
// - `useDisclosure(props, state, ref)` → `disclosureProps(props, state)` returning `{ buttonProps, panelProps }`
//   (RA keys); reactive values are accessors (bind them). Handlers are free functions
//   (`disclosureButtonPress`, `disclosureButtonPressStart`, `disclosurePanelBeforeMatch`) for inline arrows.
// - Ids derive from `props.id` (`<id>-trigger`, `<id>-panel`) instead of `useId`, so they are stable
//   across server render and resume.
// - The layout effect (hidden + `--disclosure-panel-width/height` + animation wait) runs inside the
//   panel's `hidden` binding (`disclosurePanelHidden`): the server renders the final value
//   (`hidden="until-found"` when collapsed, which unsupporting browsers treat as `hidden`), the browser
//   runs it only on a change, so nothing runs at load.
// Deviation: upstream SSR renders boolean `hidden` and switches to `until-found` in a layout effect; Rivet's
// binding returns `until-found` from the start and every target writes the keyword verbatim (server
// `template.ts`, compiler literals `html.rs`, DOM v1 / v2), so the server HTML is already `hidden="until-found"`.
import { untrack } from "@rivetjs/reactivity";
import type { PressEvent } from "../interactions/press.tsx";
import { toggleDisclosure, type DisclosureState } from "../state/disclosure.ts";

export interface AriaDisclosureProps {
  /** Id base of the button / panel (Rivet: replaces `useId`). */
  id: string;
  /** Rivet: the panel element (RA `ref`), read by the `hidden` binding in the browser. */
  panelRef?: () => HTMLElement | null | undefined;
  /** Whether the disclosure is disabled (Rivet, live props: an accessor read at press time). */
  isDisabled?: boolean | (() => boolean);
}

export interface DisclosureAria {
  /** Props for the disclosure button (AriaButtonProps: spread onto / pass to a Button). */
  buttonProps: {
    id: string;
    "aria-expanded": () => boolean;
    "aria-controls": string;
    isDisabled: boolean | (() => boolean);
    onPress: (e: PressEvent) => void;
    onPressStart: (e: PressEvent) => void;
  };
  /** Props for the disclosure panel. */
  panelProps: {
    id: string;
    role: "group";
    "aria-labelledby": string;
    "aria-hidden": () => boolean;
    hidden: () => "until-found" | undefined;
  };
}

export const disclosureTriggerId = (id: string): string => id + "-trigger";
export const disclosurePanelId = (id: string): string => id + "-panel";

const disabledNow = (props: AriaDisclosureProps): boolean => !!(typeof props.isDisabled === "function" ? props.isDisabled() : props.isDisabled);

/** `onPress` of the button: toggles for non-keyboard presses. */
export function disclosureButtonPress(e: PressEvent, props: AriaDisclosureProps, state: DisclosureState): void {
  if (!disabledNow(props) && e.pointerType !== "keyboard") toggleDisclosure(state);
}

/** `onPressStart` of the button: keyboard presses toggle on key down. */
export function disclosureButtonPressStart(e: PressEvent, props: AriaDisclosureProps, state: DisclosureState): void {
  if (e.pointerType === "keyboard" && !disabledNow(props)) toggleDisclosure(state);
}

// Pending "restore until-found" frames, by panel (upstream `raf` ref).
const frames = new WeakMap<Element, number>();
// Last expanded value the browser applied, by panel (upstream `isExpandedRef`).
const applied = new WeakMap<Element, boolean>();

/** `beforematch` on the panel (find-in-page hit a collapsed panel): expand, restore `until-found` next frame. */
export function disclosurePanelBeforeMatch(e: Event, _props: AriaDisclosureProps, state: DisclosureState): void {
  const panel = e.currentTarget as HTMLElement | null;
  if (!panel) return;
  // Wait a frame to revert browser's removal of hidden attribute.
  frames.set(
    panel,
    requestAnimationFrame(() => panel.setAttribute("hidden", "until-found")),
  );
  toggleDisclosure(state);
}

const setSize = (panel: HTMLElement, width: string, height: string): void => {
  panel.style.setProperty("--disclosure-panel-width", width);
  panel.style.setProperty("--disclosure-panel-height", height);
};

/** Server style of the panel: the size variables of the initial state. */
export const disclosurePanelStyle = (isExpanded: boolean): string =>
  isExpanded ? "--disclosure-panel-width:auto;--disclosure-panel-height:auto" : "--disclosure-panel-width:0px;--disclosure-panel-height:0px";

/**
 * The panel's `hidden` value (binding): on the server / first read the static value; in the browser on
 * each change the upstream layout effect (size variables in px, wait for the animations, then `auto` /
 * `hidden="until-found"`).
 */
export function disclosurePanelHidden(state: DisclosureState, panelRef: () => HTMLElement | null | undefined): "until-found" | undefined {
  const isExpanded = state.isExpanded();
  const value = isExpanded ? undefined : "until-found";
  // Server render / first read: no element yet.
  const panel = untrack(panelRef);
  if (!panel) return value;
  // Cancel any pending RAF to prevent stale updates.
  const frame = frames.get(panel);
  if (frame !== undefined) {
    cancelAnimationFrame(frame);
    frames.delete(panel);
  }
  const previous = applied.has(panel) ? applied.get(panel) : !panel.hasAttribute("hidden");
  applied.set(panel, isExpanded);
  if (typeof panel.getAnimations !== "function") {
    // Without animation support (and in tests), set attributes without animation.
    setSize(panel, isExpanded ? "auto" : "0px", isExpanded ? "auto" : "0px");
    return value;
  }
  if (isExpanded === previous) return value;
  if (isExpanded) {
    panel.removeAttribute("hidden");
    // Set the width and height as pixels so they can be animated.
    setSize(panel, panel.scrollWidth + "px", panel.scrollHeight + "px");
    Promise.all(panel.getAnimations().map((a) => a.finished))
      // After the animations complete, switch back to auto so the content can resize.
      .then(() => untrack(state.isExpanded) && setSize(panel, "auto", "auto"))
      .catch(() => {});
    return undefined;
  }
  setSize(panel, panel.scrollWidth + "px", panel.scrollHeight + "px");
  // Force style re-calculation to trigger animations.
  void panel.ownerDocument.defaultView?.getComputedStyle(panel).height;
  // Animate to zero size.
  setSize(panel, "0px", "0px");
  const animations = panel.getAnimations();
  if (!animations.length) return value;
  // Wait for animations to apply the hidden attribute.
  Promise.all(animations.map((a) => a.finished))
    .then(() => !untrack(state.isExpanded) && panel.setAttribute("hidden", "until-found"))
    .catch(() => {});
  return undefined;
}

/**
 * Provides the behavior and accessibility implementation for a disclosure component
 * (react-aria `useDisclosure`).
 */
export function disclosureProps(props: AriaDisclosureProps, state: DisclosureState): DisclosureAria {
  const { isDisabled = false } = props;
  const triggerId = disclosureTriggerId(props.id);
  const panelId = disclosurePanelId(props.id);
  const panelRef = props.panelRef ?? (() => null);
  return {
    buttonProps: {
      id: triggerId,
      "aria-expanded": () => state.isExpanded(),
      "aria-controls": panelId,
      isDisabled,
      onPress: (e) => disclosureButtonPress(e, props, state),
      onPressStart: (e) => disclosureButtonPressStart(e, props, state),
    },
    panelProps: {
      id: panelId,
      // This can be overridden at the panel element level.
      role: "group",
      "aria-labelledby": triggerId,
      "aria-hidden": () => !state.isExpanded(),
      hidden: () => disclosurePanelHidden(state, panelRef),
    },
  };
}
