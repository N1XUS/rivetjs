// Ported from react-aria-components `Group` (packages/react-aria-components/src/Group.tsx), Apache-2.0, © Adobe.
// A `role="group"` container with hover, focus-within and focus-visible state for styling grouped controls
// (input + buttons: NumberField, ColorField, DatePicker, ComboBox provide its props through `GroupContext`).
// Rivet:
// - render props are accessors (`class={({ isFocusWithin }) => …}`); the interaction states are signals only when
//   a `class` / `style` / `children` function asks for them. `data-hovered` / `data-focus-within` /
//   `data-focus-visible` are written by the handlers (`../utils/data-attrs.tsx`): zero cost before interaction.
// - `isDisabled` / `isInvalid` / `isReadOnly` / `aria-disabled` / `aria-invalid` may be accessors (from props or
//   `GroupContext`): read in the attribute bindings, the group is not re-created.
// - `class` = RAC `className` (default `rv-Group`).
// - focus within = `focusin` / `focusout` (`onFocusIn` / `onFocusOut` props are chained after the group's own);
//   `onFocus` / `onBlur` / `onKeyDown` / `onKeyUp` go to the element as given (RAC spreads every HTML attribute).
// `render` (RAC DOMRenderProps): given, the attributes go to `render(attrs, GroupRenderProps)` instead of the default `<div>`.
// Deviations: RA useHover's "end hover when isDisabled turns true" effect is not ported (the
// hover ends at the next pointerleave; `data-hovered` is not written while disabled).
import { createContext, signal, type Signal } from "@rivetjs/reactivity";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import {
  dataBool,
  focusStateBlur,
  focusStateFocus,
  hoverStateEnter,
  hoverStateLeave,
  hoverStateOver,
  type InteractionStateOptions,
} from "../utils/data-attrs.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import { contextProps, renderPropsOf, type ContextValue, type RefValue, type RenderProps, type SlotProps } from "../slots/index.tsx";
import type { AriaLabelingProps, DOMProps, HoverEvents } from "../utils/types.ts";
import { hasLive, liveOptions } from "../utils/live.tsx";

/** Global DOM events / props the group handles itself. */
const OWNED = ["onPointerEnter", "onPointerLeave", "style", "render"] as const;

export interface GroupRenderProps {
  /** Whether the group is currently hovered with a mouse. `[data-hovered]` */
  isHovered: () => boolean;
  /** Whether an element within the group is focused, either via a mouse or keyboard. `[data-focus-within]` */
  isFocusWithin: () => boolean;
  /** Whether an element within the group is keyboard focused. `[data-focus-visible]` */
  isFocusVisible: () => boolean;
  /** Whether the group is disabled. `[data-disabled]` */
  isDisabled: () => boolean;
  /** Whether the group is invalid. `[data-invalid]` */
  isInvalid: () => boolean;
}

type BoolAttr = MaybeAccessor<boolean | "true" | "false" | undefined>;

export interface GroupProps
  extends
    AriaLabelingProps,
    DOMProps,
    HoverEvents,
    RenderProps<GroupRenderProps>,
    DOMRenderProps<"div", GroupRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** Whether the group is disabled (may be an accessor). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /** Whether the group is invalid (may be an accessor). */
  isInvalid?: MaybeAccessor<boolean | undefined>;
  /** Whether the group is read only (may be an accessor). */
  isReadOnly?: MaybeAccessor<boolean | undefined>;
  /**
   * An accessibility role for the group. `'region'` when the contents are important enough to be in the page
   * table of contents, `'presentation'` when the group is visual only.
   * @default 'group'
   */
  role?: "group" | "region" | "presentation";
  /** `isDisabled` defaults to it (RAC). */
  "aria-disabled"?: BoolAttr;
  /** `isInvalid` defaults to it (RAC). */
  "aria-invalid"?: MaybeAccessor<boolean | "true" | "false" | "grammar" | "spelling" | undefined>;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onFocusIn?: (e: FocusEvent) => void;
  onFocusOut?: (e: FocusEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `GroupContext` (NumberField, ColorField, DatePicker, ComboBox provide the group's props). */
export const GroupContext = createContext<ContextValue<GroupProps, HTMLDivElement>>({});

const isFn = (v: unknown): boolean => typeof v === "function";
const truthy = (v: unknown): boolean => !!v && v !== "false";
const attr = (v: unknown): string | undefined => (v == null ? undefined : String(v));

const GROUP_LIVE = ["isDisabled", "isInvalid", "isReadOnly", "aria-disabled", "aria-invalid"] as const;

/** A group of related UI controls (RAC `Group`). */
export function Group(inProps: GroupProps) {
  // SELECT-B: the body stays in the component (no lowercase helper): the build's boundary facts see only a
  // component's own body, so its handlers / keyed state make an instance with no stateful caller a boundary.
  // Live props (P5): isDisabled / isInvalid / isReadOnly / aria-disabled / aria-invalid become accessors (the part reads
  // them with `read`), class / style / children from a live view; the rest of the body is read once (`_c` untracks it).
  const [ctxProps, ref] = contextProps(inProps, inProps.ref, GroupContext) as [GroupProps, RefValue<HTMLDivElement> | undefined];
  const props = hasLive(ctxProps) ? liveOptions(ctxProps, GROUP_LIVE as never) : ctxProps;
  const { id, onPointerEnter, onPointerLeave, onFocus, onBlur, onFocusIn, onFocusOut, onKeyDown, onKeyUp } = props;
  const isDisabledProp = props.isDisabled;
  const isInvalidProp = props.isInvalid;
  const isReadOnlyProp = props.isReadOnly;
  const ariaDisabled = props["aria-disabled"];
  const ariaInvalid = props["aria-invalid"];
  // RAC: `isDisabled ??= aria-disabled`, `isInvalid ??= aria-invalid` (both may be accessors).
  const isDisabled = (): boolean => !!(read(isDisabledProp) ?? truthy(read(ariaDisabled)));
  const isInvalid = (): boolean => !!(read(isInvalidProp) ?? truthy(read(ariaInvalid)));

  const wantsStates = isFn(props.class) || isFn(props.style) || isFn(props.children);
  const hovered: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const focusWithin: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const focusVisible: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const interaction: InteractionStateOptions = {
    isDisabled,
    within: true,
    onHoverStart: props.onHoverStart,
    onHoverEnd: props.onHoverEnd,
    onHoverChange: props.onHoverChange,
    states: wantsStates ? { isHovered: hovered, isFocused: focusWithin, isFocusVisible: focusVisible } : undefined,
  };
  const values: GroupRenderProps = {
    isHovered: () => !!hovered?.(),
    isFocusWithin: () => !!focusWithin?.(),
    isFocusVisible: () => !!focusVisible?.(),
    isDisabled,
    isInvalid,
  };
  const rp = renderPropsOf(props, { values, defaultClassName: "rv-Group" });
  const role = props.role ?? "group";
  const slot = props.slot ?? undefined;
  const ariaLabel = props["aria-label"];
  const labelledBy = props["aria-labelledby"];
  const describedBy = props["aria-describedby"];
  const details = props["aria-details"];
  // Read every prop up front: an element with a spread resumes as one binding over all its attributes.
  const dom = globalDOMProps(props, OWNED);
  if (props.render)
    return props.render(
      {
        ...dom,
        ref: ref as never,
        id,
        role,
        slot,
        class: () => rp.class(),
        style: () => rp.style(),
        "aria-label": ariaLabel,
        "aria-labelledby": labelledBy,
        "aria-describedby": describedBy,
        "aria-details": details,
        "aria-disabled": () => attr(read(ariaDisabled)),
        "aria-invalid": () => attr(read(ariaInvalid)),
        "data-disabled": () => dataBool(isDisabled()),
        "data-invalid": () => dataBool(isInvalid()),
        "data-readonly": () => dataBool(read(isReadOnlyProp)),
        onPointerEnter: (event: PointerEvent) => {
          hoverStateEnter(interaction, event);
          onPointerEnter?.(event as never);
        },
        onPointerLeave: (event: PointerEvent) => {
          hoverStateLeave(interaction, event);
          onPointerLeave?.(event as never);
        },
        onFocusIn: (event: FocusEvent) => {
          focusStateFocus(interaction, event);
          onFocusIn?.(event);
        },
        onFocusOut: (event: FocusEvent) => {
          focusStateBlur(interaction, event);
          onFocusOut?.(event);
        },
        onFocus,
        onBlur,
        onKeyDown,
        onKeyUp,
        children: () => rp.children(),
      } as never,
      values,
    );
  return (
    <div
      {...dom}
      ref={ref as never}
      id={id}
      role={role}
      slot={slot}
      class={rp.class()}
      style={rp.style()}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-details={details}
      aria-disabled={attr(read(ariaDisabled))}
      aria-invalid={attr(read(ariaInvalid))}
      data-disabled={dataBool(isDisabled())}
      data-invalid={dataBool(isInvalid())}
      data-readonly={dataBool(read(isReadOnlyProp))}
      onPointerOver={(event) => hoverStateOver(interaction, event)}
      onPointerEnter={onPointerEnter ? (event) => onPointerEnter(event as never) : undefined}
      onPointerLeave={onPointerLeave ? (event) => onPointerLeave(event as never) : undefined}
      onFocusIn={(event) => {
        focusStateFocus(interaction, event);
        onFocusIn?.(event);
      }}
      onFocusOut={(event) => {
        focusStateBlur(interaction, event);
        onFocusOut?.(event);
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      {rp.children()}
    </div>
  );
}
