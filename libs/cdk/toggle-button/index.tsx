// Ported from react-aria-components `ToggleButton` + react-aria `useToggleButton`
// (packages/react-aria-components/src/ToggleButton.tsx, packages/react-aria/src/button/useToggleButton.ts), Apache-2.0, © Adobe.
// <button type="button" aria-pressed>. Style the pressed state with `[aria-pressed="true"]` /
// `[data-selected]` (Tailwind `aria-pressed:`); `data-pressed` while pressed (press.ts).
// Rivet:
// - `ToggleButtonContext` (RAC): props for the ToggleButtons inside a component, optionally per `slot` (`contextProps`),
//   resumable token `rv-toggle-button`.
// - render props are accessors (`class={({ isSelected }) => (isSelected() ? "on" : "")}`; RAC `ToggleButtonRenderProps`:
//   `isHovered` / `isPressed` / `isFocused` / `isFocusVisible` / `isDisabled` / `isSelected` + `state`); hover / focus / press
//   state signals exist only when a `class` / `style` / `children` function asks for them. `data-hovered` / `data-focused` /
//   `data-focus-visible` are written by the handlers on the element (`../utils/data-attrs.tsx`; zero cost before interaction),
//   `data-pressed` by `../button/press.ts`.
// - `render` (RAC DOMRenderProps): given, the attributes object goes to `render(attrs, ToggleButtonRenderProps)` instead of
//   the default `<button>` (early return before the compiled element).
// - `excludeFromTabOrder` may be an accessor (a roving tab stop: `@rivetjs/ui/segment` keeps only the selected item tabbable).
// - `class` = RAC `className` (default `rv-ToggleButton`). `isSelected` = a two-way `Signal<boolean>` (`controllable`).
// - In a `ToggleButtonGroup`, disabled = own `isDisabled` || the group's live `isDisabled` (`isGroupDisabled(groupState)`),
//   read where it is used (`isGroupDisabled`: bindings, render prop, hover switch, press handlers), so a live group `isDisabled` disables / enables
//   the buttons in place (React re-renders them with the new group state).
import { createContext, provide, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import { hasLive, liveAt, liveOptions, liveView } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";
import { isSlot } from "@rivetjs/runtime/slot";
import { SelectionIndicatorContext } from "../selection-indicator/context.ts";
import { createToggleState, type ToggleState } from "../state/toggle.ts";
import { toggleButtonClick, toggleButtonKeyDown, toggleButtonPointerDown } from "./behaviour.ts";
import type { PressEvent, PressOptions } from "../button/press.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "@rivetjs/cdk/dom-props";
import type { Key } from "../collections/types.ts";
import { isGroupDisabled, isKeySelected, setSelected as setGroupSelected } from "../state/toggle-group.ts";
import { ToggleGroupStateContext } from "../toggle-button-group/context.ts";
import { toggleButtonGroupItemClick, toggleButtonGroupItemKeyDown, toggleButtonGroupItemPointerDown } from "../toggle-button-group/item.tsx";
import { focusStateIn, hoverStateOver, type InteractionStateOptions } from "../utils/data-attrs.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import type { HoverEvents } from "../utils/types.ts";
import { contextProps, renderProps as resolveRenderProps, type ContextValue, type RefValue, type RenderProps, type SlotProps } from "../slots/index.tsx";

/** Global DOM events ToggleButton handles itself (the user's run from its own handler) + the `style` render prop. */
const OWNED = ["render", "onPointerDown", "onClick", "onPointerEnter", "onPointerLeave", "onPointerOver", "style"] as const;

const isFn = (v: unknown): boolean => typeof v === "function" && !isSlot(v);
const str = (v: unknown): string | undefined => (v === undefined ? undefined : String(v));

/** Props read through the live view when one is live (live props P5). */
const LIVE_KEYS = [
  "isDisabled",
  "excludeFromTabOrder",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-expanded",
  "aria-haspopup",
] as const;

/** Render props of `ToggleButton` (RAC `ToggleButtonRenderProps`; accessors, `@selector` = the matching attribute). */
export interface ToggleButtonRenderProps {
  /** Hovered with a mouse. @selector [data-hovered] */
  isHovered: () => boolean;
  /** Pressed. @selector [data-pressed] */
  isPressed: () => boolean;
  /** Focused (mouse or keyboard). @selector [data-focused] */
  isFocused: () => boolean;
  /** Keyboard focused. @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** Disabled. @selector [data-disabled] */
  isDisabled: () => boolean;
  /** Selected. @selector [data-selected] */
  isSelected: () => boolean;
  /** State of the toggle button. */
  state: ToggleState;
}

export interface ToggleButtonProps
  extends
    HoverEvents,
    SlotProps,
    RenderProps<ToggleButtonRenderProps>,
    DOMRenderProps<"button", ToggleButtonRenderProps>,
    Omit<GlobalDOMAttributes<HTMLButtonElement>, "style"> {
  /** Selection (RA `isSelected`): a value (controlled; a live value-form prop updates in place) or a two-way Signal. */
  isSelected?: boolean | Signal<boolean>;
  defaultSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  onPress?: (event: PressEvent) => void;
  onPressStart?: (event: PressEvent) => void;
  onPressEnd?: (event: PressEvent) => void;
  onPressChange?: (isPressed: boolean) => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onFocusChange?: (isFocused: boolean) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  isDisabled?: boolean;
  /** RA `excludeFromTabOrder` (Rivet: also an accessor, read in the `tabindex` binding — a roving tab stop). */
  excludeFromTabOrder?: boolean | (() => boolean);
  autoFocus?: boolean;
  /**
   * Inside a `ToggleButtonGroup`: the item's key in the group's `selectedKeys` (not rendered as the DOM id).
   * Standalone: the element's id (`String(id)`).
   */
  id?: Key;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-controls"?: string;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: boolean | "menu" | "listbox" | "tree" | "grid" | "dialog";
  ref?: RefValue<HTMLButtonElement>;
}

/** RAC `ToggleButtonContext`: props for the ToggleButtons inside a component, optionally per `slot`. */
export const ToggleButtonContext = createContext<ContextValue<ToggleButtonProps, HTMLButtonElement>>({});

type BE<T extends Event> = T & { currentTarget: HTMLButtonElement };

export function ToggleButton(inProps: ToggleButtonProps) {
  const [props, ref] = contextProps(inProps, inProps.ref, ToggleButtonContext) as [ToggleButtonProps, RefValue<HTMLButtonElement> | undefined];
  // RAC: inside a ToggleButtonGroup (and with an `id`) the group state owns the selection (useToggleButtonGroupItem).
  const groupState = useContext(ToggleGroupStateContext);
  const groupId = props.id;
  const inGroup = groupState != null && groupId != null;
  // In a group the state follows the group's selection (RAC `useToggleState({ isSelected: selectedKeys.has(id), onChange: setSelected })`).
  const state = inGroup
    ? createToggleState({ isSelected: () => isKeySelected(groupState, groupId), onChange: (isSelected) => setGroupSelected(groupState, groupId, isSelected) })
    : createToggleState(liveOptions(props, ["isDisabled"], ["isSelected"]));
  // Live props (P5): state / ARIA props through a narrow view when one is live (read in bindings / at event time).
  const lv = hasLive(props) ? liveView(props, LIVE_KEYS) : undefined;
  const ownIsDisabled = (lv ? liveAt(lv, "isDisabled") : props.isDisabled) as boolean | (() => boolean | undefined) | undefined;
  // Untracked: a live class / style / children read in the body would re-create the button on a resumed page.
  const wantsStates = untrack(() => isFn(props.class) || isFn(props.style) || isFn(props.children));
  const hovered: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const pressed: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const focused: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const focusVisible: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const userPressChange = props.onPressChange;
  const press: PressOptions = {
    onPress: props.onPress,
    onPressStart: props.onPressStart,
    onPressEnd: props.onPressEnd,
    onPressChange: (isPressed: boolean) => {
      pressed?.set(isPressed);
      userPressChange?.(isPressed);
    },
  };
  const { onKeyDown, onKeyUp, onPointerDown, onClick, onPointerEnter, onPointerLeave, onPointerOver } = props;
  const dom = globalDOMProps(props, OWNED);
  const idProp = inGroup || groupId == null ? undefined : String(groupId);
  const radio = inGroup && groupState.selectionMode === "single";
  const ownDisabled = state.disabled;
  const stateDisabled = state.isDisabled;
  // In a group: read at use (the group's `isDisabled` is live); standalone: the state's value (its accessor when live).
  const isDisabled = (): boolean => (inGroup ? !!(read(ownIsDisabled) || isGroupDisabled(groupState)) : stateDisabled ? !!stateDisabled() : ownDisabled);
  const isSelected = () => (inGroup ? isKeySelected(groupState, groupId) : state.selected());
  const interaction: InteractionStateOptions = {
    isDisabled: () => isDisabled(),
    onHoverStart: props.onHoverStart,
    onHoverEnd: props.onHoverEnd,
    onHoverChange: props.onHoverChange,
    onFocus: props.onFocus,
    onBlur: props.onBlur,
    onFocusChange: props.onFocusChange,
    states: wantsStates ? { isHovered: hovered, isFocused: focused, isFocusVisible: focusVisible } : undefined,
  };
  const values: ToggleButtonRenderProps = {
    isHovered: () => !!hovered?.(),
    isPressed: () => !!pressed?.(),
    isFocused: () => !!focused?.(),
    isFocusVisible: () => !!focusVisible?.(),
    isDisabled: () => isDisabled(),
    isSelected,
    state,
  };
  const renderProps = lv
    ? resolveRenderProps({ values, defaultClassName: "rv-ToggleButton" }, liveRenderProps(props) as never)
    : resolveRenderProps({ class: props.class, style: props.style, children: props.children, values, defaultClassName: "rv-ToggleButton" });
  const slot = props.slot || undefined;
  const autoFocus = props.autoFocus;
  const excludeFromTabOrder = lv ? liveAt(lv, "excludeFromTabOrder") : props.excludeFromTabOrder;
  // Live: an accessor read in the attribute binding; static: the value.
  const ariaLabel = (lv ? liveAt(lv, "aria-label") : props["aria-label"]) as MaybeAccessor<string | undefined>;
  const ariaLabelledby = (lv ? liveAt(lv, "aria-labelledby") : props["aria-labelledby"]) as MaybeAccessor<string | undefined>;
  const ariaDescribedby = (lv ? liveAt(lv, "aria-describedby") : props["aria-describedby"]) as MaybeAccessor<string | undefined>;
  const ariaControls = (lv ? liveAt(lv, "aria-controls") : props["aria-controls"]) as MaybeAccessor<string | undefined>;
  const ariaExpanded = (lv ? liveAt(lv, "aria-expanded") : props["aria-expanded"]) as MaybeAccessor<boolean | undefined>;
  const ariaHaspopup = (lv ? liveAt(lv, "aria-haspopup") : props["aria-haspopup"]) as MaybeAccessor<ToggleButtonProps["aria-haspopup"]>;
  // `render`: the same attributes as one object (reactive entries are accessors, read by the element spread). Built only when given.
  if (props.render)
    return props.render(
      {
        ...dom,
        type: "button",
        id: idProp,
        ref: ref as never,
        class: () => renderProps.class(),
        style: () => renderProps.style(),
        slot,
        autoFocus,
        tabindex: () => ((typeof excludeFromTabOrder === "function" ? excludeFromTabOrder() : excludeFromTabOrder) ? -1 : undefined),
        "aria-label": () => read(ariaLabel),
        "aria-labelledby": () => read(ariaLabelledby),
        "aria-describedby": () => read(ariaDescribedby),
        "aria-controls": () => read(ariaControls),
        "aria-expanded": () => str(read(ariaExpanded)),
        "aria-haspopup": () => str(read(ariaHaspopup)),
        role: radio ? "radio" : undefined,
        "aria-checked": () => (radio ? (isSelected() ? "true" : "false") : undefined),
        "aria-pressed": () => (radio ? undefined : isSelected() ? "true" : "false"),
        "data-selected": () => (isSelected() ? "true" : undefined),
        "data-disabled": () => isDisabled() || undefined,
        disabled: () => isDisabled() || undefined,
        // Unconditional inline arrows (a resumed spread only takes inline functions in an object literal, not a conditional).
        onPointerDown: (event: BE<PointerEvent>) => {
          if (inGroup) toggleButtonGroupItemPointerDown(event, { ...press, isDisabled: !!read(ownIsDisabled), id: groupId }, groupState);
          else toggleButtonPointerDown(state, press, event);
          onPointerDown?.(event);
        },
        onKeyDown: (event: BE<KeyboardEvent>) => {
          if (inGroup) toggleButtonGroupItemKeyDown(event, { ...press, isDisabled: !!read(ownIsDisabled), id: groupId }, groupState);
          else toggleButtonKeyDown(state, press, event);
          onKeyDown?.(event);
        },
        onKeyUp: (event: BE<KeyboardEvent>) => onKeyUp?.(event),
        onClick: (event: BE<MouseEvent>) => {
          if (inGroup) toggleButtonGroupItemClick(event, { ...press, isDisabled: !!read(ownIsDisabled), id: groupId }, groupState);
          else toggleButtonClick(state, press, event);
          onClick?.(event as never);
        },
        onPointerOver: (event: BE<PointerEvent>) => {
          // The user's pointerover first: React Aria starts the hover on pointerenter, after it.
          onPointerOver?.(event as never);
          hoverStateOver(interaction, event);
        },
        // A user enter / leave binds natively (conditional object literals: resumable inline arrows).
        ...(onPointerEnter ? { onPointerEnter: (event: PointerEvent) => onPointerEnter(event as never) } : {}),
        ...(onPointerLeave ? { onPointerLeave: (event: PointerEvent) => onPointerLeave(event as never) } : {}),
        onFocusIn: (event: BE<FocusEvent>) => focusStateIn(interaction, event),
        children: () => provide(SelectionIndicatorContext, { isSelected }, () => renderProps.children()),
      } as never,
      values,
    );
  return (
    <button
      {...dom}
      type="button"
      id={idProp}
      ref={ref as never}
      class={renderProps.class()}
      style={renderProps.style()}
      slot={slot}
      autoFocus={autoFocus}
      tabIndex={(typeof excludeFromTabOrder === "function" ? excludeFromTabOrder() : excludeFromTabOrder) ? -1 : undefined}
      aria-label={read(ariaLabel)}
      aria-labelledby={read(ariaLabelledby)}
      aria-describedby={read(ariaDescribedby)}
      aria-controls={read(ariaControls)}
      aria-expanded={str(read(ariaExpanded))}
      aria-haspopup={str(read(ariaHaspopup))}
      role={radio ? "radio" : undefined}
      aria-checked={radio ? (isSelected() ? "true" : "false") : undefined}
      aria-pressed={radio ? undefined : isSelected() ? "true" : "false"}
      data-selected={isSelected() ? "true" : undefined}
      data-disabled={isDisabled() || undefined}
      disabled={isDisabled() || undefined}
      onPointerDown={(event) => {
        if (inGroup) toggleButtonGroupItemPointerDown(event, { ...press, isDisabled: !!read(ownIsDisabled), id: groupId }, groupState);
        else toggleButtonPointerDown(state, press, event);
        onPointerDown?.(event);
      }}
      onKeyDown={(event) => {
        if (inGroup) toggleButtonGroupItemKeyDown(event, { ...press, isDisabled: !!read(ownIsDisabled), id: groupId }, groupState);
        else toggleButtonKeyDown(state, press, event);
        onKeyDown?.(event);
      }}
      onKeyUp={onKeyUp ? (event) => onKeyUp(event) : undefined}
      onClick={(event) => {
        if (inGroup) toggleButtonGroupItemClick(event, { ...press, isDisabled: !!read(ownIsDisabled), id: groupId }, groupState);
        else toggleButtonClick(state, press, event);
        onClick?.(event);
      }}
      onPointerOver={(event) => {
        // The user's pointerover first: React Aria starts the hover on pointerenter, after it.
        onPointerOver?.(event as never);
        hoverStateOver(interaction, event);
      }}
      onPointerEnter={onPointerEnter ? (event) => onPointerEnter(event as never) : undefined}
      onPointerLeave={onPointerLeave ? (event) => onPointerLeave(event as never) : undefined}
      onFocusIn={(event) => focusStateIn(interaction, event)}
    >
      {/* RAC ToggleButton: `SelectionIndicatorContext` around the content (`isSelected` an accessor). */}
      {provide(SelectionIndicatorContext, { isSelected }, () => renderProps.children())}
    </button>
  );
}
