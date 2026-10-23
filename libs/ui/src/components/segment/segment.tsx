// Rivet addition (no HeroUI v3.2.6 counterpart): segmented control. Feature set inspired by HeroUI Pro's public docs
// (Segment: `variant` default / ghost, `size` sm / md / lg, `selectedKey` / `defaultSelectedKey` / `onSelectionChange(key)`,
// `Segment.Item` / `Segment.Separator`); independent implementation, Rivet-authored styles on HeroUI tokens.
// Behaviour = `@rivetjs/cdk/toggle-button-group` in single selection (`role="radiogroup"`, items `role="radio"` +
// `aria-checked`, toolbar arrow keys move focus, Enter / Space select; RAC ToggleButtonGroup semantics) with
// `disallowEmptySelection`, the cdk `selectedKey` extension (two-way `Signal<Key | null>`), and a cdk `SelectionIndicator` per
// item (one shared element: moves between the items with CSS transitions, none with reduced motion).
// - `SegmentContext` (resumable `rv-ui-segment`, `{}` default) carries plain data `{ inSegment, size, variant }` (getters when
//   live); slots come from a module-level memo per `size|variant`.
// - Roving tab stop (APG radio group): while an item is selected, only it is in the Tab order (the others get
//   `tabindex="-1"` through the cdk ToggleButton's accessor `excludeFromTabOrder`), in the server HTML too — before
//   resume a native Tab leaves the group after one stop, as the resumed toolbar's Tab handling does; arrow keys still reach
//   every item (the toolbar's focus manager includes `tabindex="-1"`). No selection: every item stays tabbable.
// - Item children: plain content renders inside `span.segment__label` next to the indicator (no render-prop state signals); a
//   function child gets the cdk ToggleButton render props (accessors: `({ isSelected }) => isSelected() ? … : …`).
import { SelectionIndicator } from "@rivetjs/cdk/selection-indicator";
import { ToggleButton as ToggleButtonPrimitive } from "@rivetjs/cdk/toggle-button";
import type { ToggleButtonProps as ToggleButtonPrimitiveProps, ToggleButtonRenderProps } from "@rivetjs/cdk/toggle-button";
import { ToggleButtonGroup as ToggleButtonGroupPrimitive, ToggleGroupStateContext } from "@rivetjs/cdk/toggle-button-group";
import { isKeySelected, selectedKeysOf } from "@rivetjs/cdk/state/toggle-group";
import type { ToggleButtonGroupProps as ToggleButtonGroupPrimitiveProps, ToggleButtonGroupRenderProps } from "@rivetjs/cdk/toggle-button-group";
import type { Key } from "@rivetjs/cdk/collections/types";
import { createContext, useContext, type Signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";

import type { SegmentVariants } from "../../../styles/src/components/segment/index.ts";
import { segmentVariants } from "../../../styles/src/components/segment/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Segment Context
 * -----------------------------------------------------------------------------------------------*/
interface SegmentContext {
  /** Set inside a Segment. */
  inSegment?: true;
  size?: SegmentVariants["size"];
  variant?: SegmentVariants["variant"];
}

const SegmentContext = createContext<SegmentContext>({});

type SegmentSlots = ReturnType<typeof segmentVariants>;

/** Module-level memo per `size|variant` (tv slot functions are pure). */
const SLOTS: Record<string, SegmentSlots> = {};
const slotsFor = (size: SegmentVariants["size"], variant: SegmentVariants["variant"]): SegmentSlots =>
  (SLOTS[`${size}|${variant}`] ??= segmentVariants({ size, variant }));

/** `undefined` outside a Segment. */
const slotsOf = (context: SegmentContext): SegmentSlots | undefined => (context.inSegment ? slotsFor(context.size, context.variant) : undefined);

/* -------------------------------------------------------------------------------------------------
 * Segment Root
 * -----------------------------------------------------------------------------------------------*/
interface SegmentRootProps
  extends
    Omit<
      ToggleButtonGroupPrimitiveProps,
      "selectionMode" | "selectedKeys" | "defaultSelectedKeys" | "onSelectionChange" | "selectedKey" | "defaultSelectedKey"
    >,
    SegmentVariants {
  /** The selected item's key (controlled: a key or `null`, or a two-way `Signal<Key | null>`). */
  selectedKey?: Key | null | Signal<Key | null> | Signal<string | null> | Signal<number | null>;
  /** The initially selected item's key (uncontrolled). */
  defaultSelectedKey?: Key;
  /** Called with the newly selected key. */
  onSelectionChange?: (key: Key) => void;
  /**
   * Whether the selection may become empty (pressing the selected item again deselects it).
   *
   * @default false
   */
  allowsEmptySelection?: boolean;
  children?: Content;
}

const CONTEXT_PROPS = ["size", "variant"] as const;

const SegmentRoot = (props: SegmentRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "size", "variant", "onSelectionChange", "allowsEmptySelection"]);
  const onChange = local.onSelectionChange;
  const contextValue: SegmentContext = hasLiveProp(local, CONTEXT_PROPS)
    ? {
        inSegment: true,
        get size() {
          return local.size;
        },
        get variant() {
          return local.variant;
        },
      }
    : { inSegment: true, size: local.size, variant: local.variant };
  const classOf = (): string | ((values: ToggleButtonGroupRenderProps) => string) =>
    composeTwRenderProps(local.class as never, slotsFor(local.size, local.variant).base());
  const cls = hasLiveProp(local, ["class", "size", "variant"]) ? (values: ToggleButtonGroupRenderProps) => renderClass(classOf(), values) : classOf();

  // A function: Rivet JSX builds nodes eagerly, so the group is created inside the provider.
  const content = () => (
    <ToggleButtonGroupPrimitive
      data-slot="segment"
      disallowEmptySelection={!local.allowsEmptySelection}
      {...(rest as ToggleButtonGroupPrimitiveProps)}
      class={cls as never}
      selectionMode="single"
      onSelectionChange={(keys: Set<Key>) => {
        const key = keys.values().next().value;
        if (key !== undefined) onChange?.(key);
      }}
    >
      {local.children}
    </ToggleButtonGroupPrimitive>
  );

  return (
    <Provider token={SegmentContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Segment Item
 * -----------------------------------------------------------------------------------------------*/
interface SegmentItemProps extends Omit<ToggleButtonPrimitiveProps, "children" | "isSelected" | "defaultSelected" | "onChange"> {
  /** The item's key in the Segment selection. */
  id: Key;
  /** Content, or a function of the ToggleButton render props (accessors). */
  children?: Content | ((values: ToggleButtonRenderProps) => Content);
}

const SegmentItem = (props: SegmentItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(SegmentContext);
  const classOf = (): string | ((values: ToggleButtonRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.item());
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, CONTEXT_PROPS) ? (values: ToggleButtonRenderProps) => renderClass(classOf(), values) : classOf();
  const children = local.children;
  const group = useContext(ToggleGroupStateContext);
  const key = props.id;
  const own = props.excludeFromTabOrder;
  // Object-literal arrow (a resumable symbol; the `tabindex` binding captures it).
  const tabStop = {
    exclude: () => (typeof own === "function" ? own() : !!own) || (!!group && selectedKeysOf(group).size > 0 && !isKeySelected(group, key)),
  };
  const indicatorClass = slotsOf(context)?.indicator();
  const labelClass = slotsOf(context)?.label();

  if (typeof children === "function" && !isSlot(children))
    return (
      <ToggleButtonPrimitive data-slot="segment-item" {...(rest as ToggleButtonPrimitiveProps)} class={cls as never} excludeFromTabOrder={tabStop.exclude}>
        {(values: ToggleButtonRenderProps) => (
          <>
            <SelectionIndicator class={indicatorClass} data-slot="segment-indicator" />
            <span class={labelClass} data-slot="segment-label">
              {(children as (v: ToggleButtonRenderProps) => Content)(values)}
            </span>
          </>
        )}
      </ToggleButtonPrimitive>
    );
  return (
    <ToggleButtonPrimitive data-slot="segment-item" {...(rest as ToggleButtonPrimitiveProps)} class={cls as never} excludeFromTabOrder={tabStop.exclude}>
      <SelectionIndicator class={indicatorClass} data-slot="segment-indicator" />
      <span class={labelClass} data-slot="segment-label">
        {children as Content}
      </span>
    </ToggleButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Segment Separator
 * -----------------------------------------------------------------------------------------------*/
interface SegmentSeparatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  class?: string;
}

type SegmentSeparatorSpanProps = SegmentSeparatorProps & Omit<JSX.IntrinsicElements["span"], keyof SegmentSeparatorProps>;

const SegmentSeparator = <E extends keyof JSX.IntrinsicElements = "span">(props: SegmentSeparatorProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SegmentSeparatorSpanProps, ["class"]);
  const context = useContext(SegmentContext);

  return <dom.span aria-hidden="true" class={composeSlotClassName(slotsOf(context)?.separator, local.class)} data-slot="segment-separator" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { SegmentRoot, SegmentItem, SegmentSeparator, SegmentContext };
export type { SegmentRootProps, SegmentItemProps, SegmentSeparatorProps, SegmentSeparatorSpanProps, ToggleButtonRenderProps as SegmentItemRenderProps };
