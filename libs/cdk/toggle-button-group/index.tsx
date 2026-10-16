// Ported from react-aria-components `ToggleButtonGroup` (packages/react-aria-components/src/ToggleButtonGroup.tsx), Apache-2.0, © Adobe.
// A group of `ToggleButton`s (each with an `id`) with single (`role="radiogroup"`) or multiple (`role="toolbar"`)
// selection; arrow keys move focus between the buttons (useToolbar).
// Rivet:
// - state = `createToggleGroupState` (`../state/toggle-group.ts`, region state); `selectedKeys` is a plain
//   iterable (controlled) or a two-way `Signal` (decision 2).
// - render props are accessors (`class={({ isDisabled }) => (isDisabled() ? … : …)}`); `state` is the state object.
// - toolbar keyboard handling = `../toolbar/behaviour.ts` (bubbling keydown / focusin / focusout, see its header).
// `render` (RAC DOMRenderProps): given, the attributes go to `render(attrs, ToggleButtonGroupRenderProps)` instead of the default `<div>`.
// - Live props: `isDisabled` / `orientation` are read lazily from the own props (a live getter: `isDisabled={d()}`), the
//   `ToggleButtonGroupContext` value when the own prop is `undefined` (RA mergeProps: last defined wins; `contextProps`
//   snapshots, so the own getter is read directly). React re-renders with the new prop: here the group state's live source
//   (`isGroupDisabled(state)`), `data-disabled` / `aria-disabled`, `data-orientation` / `aria-orientation` / `data-rk` and the toolbar arrow
//   keys follow the change in place, and every `ToggleButton` reads the group's `isDisabled` where it is used.
// Deviations: no `ref` forwarding to the toolbar hook (handlers use
// `event.currentTarget`).
import { untrack } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { contextProps, renderPropsOf, slottedContext, type RefValue, type ClassNameOrFunction, type RenderProps, type SlotProps } from "../slots/index.tsx";
import type { Orientation } from "../collections/types.ts";
import { createToggleGroupState, type ToggleGroupState } from "../state/toggle-group.ts";
import { toolbarBlur, toolbarFocus, toolbarKeyDown, toolbarKeys } from "../toolbar/behaviour.ts";
import { SharedElementTransition } from "../shared-element-transition/transition.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { toggleButtonGroupProps, type AriaToggleButtonGroupProps } from "./behaviour.tsx";
import { ToggleButtonGroupContext, ToggleGroupStateContext } from "./context.ts";
import { liveOptions } from "../utils/live.tsx";

export { ToggleButtonGroupContext, ToggleGroupStateContext } from "./context.ts";
export type { ToggleGroupState } from "../state/toggle-group.ts";

/** Global DOM events / attributes the group handles itself. */
const OWNED = ["style", "render"] as const;

export interface ToggleButtonGroupRenderProps {
  /**
   * The orientation of the toggle button group.
   *
   * @selector [data-orientation="horizontal | vertical"]
   */
  orientation: () => Orientation;
  /**
   * Whether the toggle button group is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /** State of the toggle button group. */
  state: ToggleGroupState;
}

export interface ToggleButtonGroupProps
  extends
    AriaToggleButtonGroupProps,
    RenderProps<ToggleButtonGroupRenderProps>,
    DOMRenderProps<"div", ToggleButtonGroupRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  id?: string;
  ref?: RefValue<HTMLDivElement>;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-ToggleButtonGroup'
   */
  class?: ClassNameOrFunction<ToggleButtonGroupRenderProps>;
}

/**
 * A toggle button group allows a user to toggle multiple options, with single or multiple
 * selection.
 */
export function ToggleButtonGroup(props: ToggleButtonGroupProps) {
  const [merged, ref] = contextProps(props, props.ref, ToggleButtonGroupContext);
  // Context props (`contextProps` already resolved the slot) for the live fallbacks below.
  const ctx = slottedContext(ToggleButtonGroupContext, props.slot) as ToggleButtonGroupProps | null | undefined;
  const isDisabled = (): boolean => !!(props.isDisabled !== undefined ? props.isDisabled : ctx?.isDisabled);
  const orientation = (): Orientation => (props.orientation !== undefined ? props.orientation : ctx?.orientation) || "horizontal";
  // Object-literal getters (registered with their captures): the state, the group props and the toolbar handlers read the live values.
  const live = {
    get isDisabled() {
      return isDisabled();
    },
    get orientation() {
      return orientation();
    },
    get disallowEmptySelection() {
      return props.disallowEmptySelection !== undefined ? props.disallowEmptySelection : ctx?.disallowEmptySelection;
    },
  };
  // Live props: a controlled `selectedKeys={k()}` / `selectedKey={k()}` stays live (accessor; never written).
  const state = createToggleGroupState(liveOptions(merged, [], ["selectedKeys", "selectedKey"]), live);
  const groupProps = toggleButtonGroupProps(merged, state, live);
  const renderValues = { orientation: () => orientation(), isDisabled: () => isDisabled(), state };
  const rp = untrack(() => renderPropsOf(merged, { values: renderValues, defaultClassName: "rv-ToggleButtonGroup" }));
  const dom = globalDOMProps(merged, OWNED);
  const id = merged.id;
  const slot = merged.slot || undefined;
  if (merged.render)
    return merged.render(
      {
        ...dom,
        ...groupProps,
        id,
        ref: ref as never,
        class: () => rp.class(),
        style: () => rp.style(),
        slot,
        "data-orientation": () => orientation(),
        "data-disabled": () => (isDisabled() ? "true" : undefined),
        "data-rk": () => toolbarKeys(orientation()),
        onKeyDown: (event: KeyboardEvent) => toolbarKeyDown(event, live),
        onFocusIn: (event: FocusEvent) => toolbarFocus(event),
        onFocusOut: (event: FocusEvent) => toolbarBlur(event),
        children: () => (
          <Provider token={ToggleGroupStateContext} value={state}>
            <SharedElementTransition>{rp.children()}</SharedElementTransition>
          </Provider>
        ),
      } as never,
      renderValues,
    );
  return (
    <div
      {...dom}
      {...groupProps}
      id={id}
      ref={ref as never}
      class={rp.class()}
      style={rp.style()}
      slot={slot}
      data-orientation={orientation()}
      data-disabled={isDisabled() ? "true" : undefined}
      data-rk={toolbarKeys(orientation())}
      onKeyDown={(event) => toolbarKeyDown(event, live)}
      onFocusIn={(event) => toolbarFocus(event)}
      onFocusOut={(event) => toolbarBlur(event)}
    >
      <Provider token={ToggleGroupStateContext} value={state}>
        <SharedElementTransition>{rp.children()}</SharedElementTransition>
      </Provider>
    </div>
  );
}
