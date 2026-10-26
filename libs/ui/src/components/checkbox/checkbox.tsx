// Ported from HeroUI v3.2.6 packages/react/src/components/checkbox/checkbox.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/{Checkbox,Label}` → `@rivetjs/cdk/{checkbox,label}`
//   (`CheckboxField` / `CheckboxButton`, accessor render props: `state.isSelected()`); `@heroui/styles` → vendored `styles/`.
// - `CheckboxContext` (resumable `rv-ui-checkbox`, `{}` default) carries `{ inCheckbox, variant, state }` instead of
//   `{ slots, state }`: slots from a module-level memo per variant (`slotsFor`); `state` = the cdk field render props (accessors).
//   `variant` = prop ?? `CheckboxGroupContext.variant` (getter when either is live).
// - `Checkbox.Indicator` defaults: upstream inline svgs (polyline checkmark, dash-offset draw 44 / 66 over a 22 dash; a line for
//   indeterminate) → lucide `Check` / `Minus` via `@rivetjs/kit/icon` (icon rule) with the same `data-slot`s
//   (`checkbox-default-indicator--checkmark` / `--indeterminate`); the checkmark keeps the draw animation on its path
//   (`stroke-dasharray` 24, offset 48 selected / 72 not: lucide's path is ~22.6 units long), the line `stroke-width` 3.
//   A function child gets the state (accessors); any other children replace the default (Rivet children are slots).
// - Function children (`typeof children === "function"`) → `!isSlot(children)` (Rivet JSX children are compiler slots).
// - `Control`: generic `dom.span` (`render` prop) as upstream; `Indicator` takes `span` props only (`render` too): its function
//   child does not unify with the generic intrinsic `children` type (TS2322).
// - Live `class` / `variant` → render-prop class functions (the composed class is a local: it reaches the cdk part as a plain value); `isSelected` / `isIndeterminate` /
//   `isDisabled` are forwarded as getters (cdk keeps them live).
// - Rivet-only: the state-space path (ZERO STATESPACE, `nativeCheckbox` below).
import {
  CheckboxButton as CheckboxButtonPrimitive,
  CheckboxField as CheckboxFieldPrimitive,
  CheckboxFieldContext,
  CheckboxGroupStateContext,
} from "@rivetjs/cdk/checkbox";
import { visuallyHidden } from "@rivetjs/cdk/a11y";
import { FormValidationContext } from "@rivetjs/cdk/form";
import type {
  CheckboxButtonProps as CheckboxButtonPrimitiveProps,
  CheckboxButtonRenderProps,
  CheckboxFieldProps as CheckboxFieldPrimitiveProps,
  CheckboxFieldRenderProps,
} from "@rivetjs/cdk/checkbox";
import { LabelContext } from "@rivetjs/cdk/label";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";
import { Check, Minus } from "lucide";

import type { CheckboxVariants } from "../../../styles/src/components/checkbox/index.ts";
import { checkboxVariants } from "../../../styles/src/components/checkbox/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { CheckboxGroupContext } from "../checkbox-group/context.ts";
import { nativeProps } from "../../utils/native.ts";
import { DEV } from "#dev";

const LABEL_SPAN_CONTEXT = { elementType: "span" as const };

interface CheckboxContext {
  /** Set inside a Checkbox (upstream: `slots`). */
  inCheckbox?: true;
  variant?: CheckboxVariants["variant"];
  state?: CheckboxFieldRenderProps;
  /** State-space path (ZERO STATESPACE): the native input's attributes; the parts render static native markup. */
  native?: NativeCheckbox;
}

/** The input of a native (zero-JS) checkbox: static attributes, the browser owns `checked`. */
interface NativeCheckbox {
  checked?: true;
  disabled?: true;
  name?: string;
  value?: string;
  id?: string;
  [aria: `aria-${string}`]: unknown;
}

const CheckboxContext = createContext<CheckboxContext>({});

type CheckboxSlots = ReturnType<typeof checkboxVariants>;

/** Module-level memo per `variant` (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, CheckboxSlots> = {};
const slotsFor = (variant: CheckboxVariants["variant"]): CheckboxSlots => (SLOTS[String(variant)] ??= checkboxVariants({ variant }));

/** Upstream `use(CheckboxContext).slots`: `undefined` outside a Checkbox. */
const slotsOf = (context: CheckboxContext): CheckboxSlots | undefined => (context.inCheckbox ? slotsFor(context.variant) : undefined);

/* -------------------------------------------------------------------------------------------------
 * State-space path (ZERO STATESPACE, as `switch.tsx`). A checkbox's states (selected, hovered, pressed, focus-visible,
 * disabled) are the native checkbox's: the browser toggles it (label click, Space) and exposes checked to assistive tech;
 * the stylesheet derives every visual state from `:checked` / `:hover` / `:active` / `:focus-visible` (the `[data-native]`
 * rules in `styles/components/checkbox.css`). The build marks the call sites where nothing else can observe or drive the
 * state (`$native`, `libs/compiler/facts-native.ts`); the root re-checks its props and contexts. Indeterminate (a DOM
 * property only script sets), a description (its id links through the cdk field) and a group / field / form provider
 * above keep the cdk path. The `id` goes on the input (as the cdk field's: an external `<Label for>` labels it).
 * -----------------------------------------------------------------------------------------------*/
// @rivet-native CheckboxRoot(children,class,variant,label,defaultSelected,isDisabled,name,value,id) CheckboxContent(children,class) CheckboxControl(children,class) CheckboxIndicator(class)
const NATIVE_ROOT = new Set(["children", "class", "variant", "label", "defaultSelected", "isDisabled", "name", "value", "id"]);

const nativeCheckbox = (props: CheckboxRootProps): NativeCheckbox | null => {
  if (!nativeProps(props, NATIVE_ROOT)) return null;
  if (useContext(CheckboxFieldContext) || useContext(CheckboxGroupStateContext) || useContext(FormValidationContext) !== undefined) return null;
  const native: NativeCheckbox = {};
  for (const key in props) if (key.startsWith("aria-")) (native as Record<string, unknown>)[key] = (props as Record<string, unknown>)[key];
  if (props.defaultSelected) native.checked = true;
  if (props.isDisabled) native.disabled = true;
  if (props.name !== undefined) native.name = props.name;
  if (props.value !== undefined) native.value = props.value as string;
  if (props.id !== undefined) native.id = props.id;
  return native;
};

/* -------------------------------------------------------------------------------------------------
 * Checkbox (Field) — React Aria `CheckboxField`.
 * -----------------------------------------------------------------------------------------------*/
interface CheckboxRootProps extends CheckboxFieldPrimitiveProps, CheckboxVariants {
  /** Shorthand (no children): the label next to the control (renders Content > Checkbox.Control > Checkbox.Indicator + label). */
  label?: Content;
  /** Shorthand (no children): a Description under the label. */
  description?: Content;

  /** The name of the checkbox, used when submitting an HTML form. */
  name?: string;
}

const CheckboxRoot = (props: CheckboxRootProps): JSX.Element => {
  const native = nativeCheckbox(props);
  if (native) {
    const variant = props.variant ?? useContext(CheckboxGroupContext).variant;
    const contextValue: CheckboxContext = { inCheckbox: true, variant, native };
    const data: Record<string, unknown> = {};
    for (const key in props) if (key.startsWith("data-")) data[key] = (props as Record<string, unknown>)[key];
    return (
      <div
        {...data}
        data-slot="checkbox"
        class={composeTwRenderProps(props.class as never, slotsFor(variant).base()) as string}
        data-disabled={native.disabled}
        data-native=""
      >
        <Provider token={CheckboxContext} value={contextValue}>
          {props.children === undefined ? (
            <CheckboxContent>
              <CheckboxControl>
                <CheckboxIndicator />
              </CheckboxControl>
              {props.label}
            </CheckboxContent>
          ) : (
            (props.children as Content)
          )}
        </Provider>
      </div>
    );
  }
  const [local, rest] = splitLive(props, [
    "children",
    "class",
    "description",
    "label",
    "variant",
    "isSelected",
    "isIndeterminate",
    "isDisabled",
    "$native" as never,
  ]);
  if (DEV && local.children !== undefined) DEV.shorthandIgnored("Checkbox", local, ["label", "description"]);
  const checkboxGroupContext = useContext(CheckboxGroupContext);
  const variantOf = () => local.variant ?? checkboxGroupContext.variant;
  const live = hasLiveProp(local, ["class", "variant"]) || hasLiveProp(checkboxGroupContext, ["variant"]);
  const classOf = (): string | ((values: CheckboxFieldRenderProps) => string) => composeTwRenderProps(local.class as never, slotsFor(variantOf()).base());
  const cls = live ? (values: CheckboxFieldRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <CheckboxFieldPrimitive
      data-slot="checkbox"
      {...(rest as object)}
      class={cls as never}
      isDisabled={local.isDisabled as never}
      isIndeterminate={local.isIndeterminate as never}
      isSelected={local.isSelected as never}
    >
      {(state: CheckboxFieldRenderProps) => {
        const contextValue: CheckboxContext = live
          ? {
              inCheckbox: true,
              get variant() {
                return variantOf();
              },
              state,
            }
          : { inCheckbox: true, variant: variantOf(), state };
        return (
          <Provider token={CheckboxContext} value={contextValue}>
            {local.children === undefined ? (
              <>
                <CheckboxContent>
                  <CheckboxControl>
                    <CheckboxIndicator />
                  </CheckboxControl>
                  {local.label}
                </CheckboxContent>
                {local.description !== undefined && <DescriptionRoot>{local.description}</DescriptionRoot>}
              </>
            ) : typeof local.children === "function" && !isSlot(local.children) ? (
              (local.children as (v: CheckboxFieldRenderProps) => Content)(state)
            ) : (
              (local.children as Content)
            )}
          </Provider>
        );
      }}
    </CheckboxFieldPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Checkbox.Content — the clickable `CheckboxButton` label wrapping the control + `Label`.
 * Keep `Description`/`FieldError` as siblings of `Checkbox.Content`.
 * -----------------------------------------------------------------------------------------------*/
interface CheckboxContentProps extends CheckboxButtonPrimitiveProps {}

const CheckboxContent = (props: CheckboxContentProps): JSX.Element => {
  const context = useContext(CheckboxContext);
  const native = context.native;
  if (native) {
    return (
      <label
        data-slot="checkbox-content"
        class={composeTwRenderProps(props.class as never, slotsOf(context)?.content()) as string}
        data-disabled={native.disabled}
        data-nc=""
      >
        <span style={visuallyHidden}>
          <input {...native} type="checkbox" />
        </span>
        <Provider token={LabelContext} value={LABEL_SPAN_CONTEXT}>
          {props.children as Content}
        </Provider>
      </label>
    );
  }
  const [local, rest] = splitLive(props, ["children", "class"]);
  const classOf = (): string | ((values: CheckboxButtonRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.content());
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, ["variant"]) ? (values: CheckboxButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <CheckboxButtonPrimitive data-slot="checkbox-content" {...(rest as object)} class={cls as never}>
      {(state: CheckboxButtonRenderProps) => (
        <Provider token={LabelContext} value={LABEL_SPAN_CONTEXT}>
          {typeof local.children === "function" && !isSlot(local.children)
            ? (local.children as (v: CheckboxButtonRenderProps) => Content)(state)
            : (local.children as Content)}
        </Provider>
      )}
    </CheckboxButtonPrimitive>
  );
};

/* -----------------------------------------------------------------------------------------------*/

interface CheckboxControlProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type CheckboxControlSpanProps = CheckboxControlProps & Omit<JSX.IntrinsicElements["span"], keyof CheckboxControlProps>;

const CheckboxControl = <E extends keyof JSX.IntrinsicElements = "span">(props: CheckboxControlProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as CheckboxControlSpanProps, ["children", "class"]);
  const context = useContext(CheckboxContext);

  return (
    <dom.span class={composeSlotClassName(slotsOf(context)?.control, local.class)} data-slot="checkbox-control" {...rest}>
      {local.children}
    </dom.span>
  );
};

/* -----------------------------------------------------------------------------------------------*/

interface CheckboxIndicatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content | ((props: CheckboxFieldRenderProps) => Content);
  class?: string;
}

type CheckboxIndicatorSpanProps = CheckboxIndicatorProps & Omit<JSX.IntrinsicElements["span"], keyof CheckboxIndicatorProps>;

// `span` props only (no element generic): a function child + the generic intrinsic `children` do not unify (TS2322), as list-box.
const CheckboxIndicator = (props: CheckboxIndicatorSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CheckboxContext);
  const state = context.state;
  // Native: the checkmark drawn by the stylesheet from `:checked` (`checkbox.css` `[data-native]`), offset 72 = not drawn.
  if (context.native && local.children === undefined)
    return (
      <dom.span aria-hidden="true" class={composeSlotClassName(slotsOf(context)?.indicator, local.class)} data-slot="checkbox-indicator" {...rest}>
        <Icon
          aria-hidden="true"
          data-slot="checkbox-default-indicator--checkmark"
          icon={Check}
          role="presentation"
          stroke-dasharray={24}
          stroke-dashoffset={72}
        />
      </dom.span>
    );

  const isSelected = () => !!state?.isSelected();
  const isIndeterminate = () => !!state?.isIndeterminate();

  const content = () =>
    typeof local.children === "function" && !isSlot(local.children) ? (
      (local.children as (v: CheckboxFieldRenderProps) => Content)(state ?? ({} as CheckboxFieldRenderProps))
    ) : local.children !== undefined ? (
      (local.children as Content)
    ) : isIndeterminate() ? (
      <Icon aria-hidden="true" data-slot="checkbox-default-indicator--indeterminate" icon={Minus} role="presentation" stroke-width={3} />
    ) : (
      <Icon
        aria-hidden="true"
        data-slot="checkbox-default-indicator--checkmark"
        icon={Check}
        role="presentation"
        stroke-dasharray={24}
        stroke-dashoffset={isSelected() ? 48 : 72}
      />
    );

  return (
    <dom.span aria-hidden="true" class={composeSlotClassName(slotsOf(context)?.indicator, local.class)} data-slot="checkbox-indicator" {...rest}>
      {content()}
    </dom.span>
  );
};

/* ----------------------------------------------------------------------------------------------*/

export { CheckboxRoot, CheckboxContent, CheckboxControl, CheckboxIndicator, CheckboxContext };
export type { CheckboxRootProps, CheckboxContentProps, CheckboxControlProps, CheckboxIndicatorProps, CheckboxFieldRenderProps, CheckboxButtonRenderProps };
export type { CheckboxControlSpanProps, CheckboxIndicatorSpanProps };
