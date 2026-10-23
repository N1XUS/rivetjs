// Ported from HeroUI v3.2.6 packages/react/src/components/radio/radio.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/{RadioGroup,Label}` → `@rivetjs/cdk/{radio-group,label}`
//   (`RadioField` / `RadioButton`, accessor render props: `state.isSelected()`); `@heroui/styles` → vendored `styles/`.
// - `RadioContext` (resumable `rv-ui-radio`, `{}` default) carries `{ inRadio, state }` instead of `{ slots, state }`:
//   slots from a module-level memo (`slotsFor`); `state` = the cdk field render props (accessors).
// - Function children (`typeof children === "function"`) → `!isSlot(children)` (Rivet JSX children are compiler slots); a
//   function child of a span part gets the field state (accessors).
// - `Control`: generic `dom.span` (`render` prop) as upstream; `Indicator` takes `span` props only (`render` too): its function
//   child does not unify with the generic intrinsic `children` type (TS2322).
// - Live `class` → render-prop class functions (the composed class is a local: it reaches the cdk part as a plain value).
import { RadioButton as RadioButtonPrimitive, RadioField as RadioFieldPrimitive } from "@rivetjs/cdk/radio-group";
import type {
  RadioButtonProps as RadioButtonPrimitiveProps,
  RadioButtonRenderProps,
  RadioFieldProps as RadioFieldPrimitiveProps,
  RadioFieldRenderProps,
} from "@rivetjs/cdk/radio-group";
import { LabelContext } from "@rivetjs/cdk/label";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";

import { radioVariants } from "../../../styles/src/components/radio/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { DEV } from "#dev";

const LABEL_SPAN_CONTEXT = { elementType: "span" as const };

interface RadioContext {
  /** Set inside a Radio (upstream: `slots`). */
  inRadio?: true;
  state?: RadioFieldRenderProps;
}

const RadioContext = createContext<RadioContext>({});

type RadioSlots = ReturnType<typeof radioVariants>;

/** Module-level memo (upstream `useMemo` per root; tv slot functions are pure). */
let SLOTS: RadioSlots | undefined;
const slotsFor = (): RadioSlots => (SLOTS ??= radioVariants());

/** Upstream `use(RadioContext).slots`: `undefined` outside a Radio. */
const slotsOf = (context: RadioContext): RadioSlots | undefined => (context.inRadio ? slotsFor() : undefined);

/* -------------------------------------------------------------------------------------------------
 * Radio (Field) — React Aria `RadioField`.
 * -----------------------------------------------------------------------------------------------*/
interface RadioRootProps extends RadioFieldPrimitiveProps {
  /** Shorthand (no children): the label next to the control (renders Content > Radio.Control > Radio.Indicator + label). */
  label?: Content;
  /** Shorthand (no children): a Description under the label. */
  description?: Content;

  /** The name of the radio button, used when submitting an HTML form. */
  name?: string;
}

const RadioRoot = (props: RadioRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "description", "label"]);
  if (DEV && local.children !== undefined) DEV.shorthandIgnored("Radio", local, ["label", "description"]);
  const live = hasLiveProp(local, ["class"]);
  const classOf = (): string | ((values: RadioFieldRenderProps) => string) => composeTwRenderProps(local.class as never, slotsFor().base());
  const cls = live ? (values: RadioFieldRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <RadioFieldPrimitive data-slot="radio" {...(rest as Omit<RadioFieldPrimitiveProps, "children" | "class">)} class={cls as never}>
      {(state: RadioFieldRenderProps) => {
        const contextValue: RadioContext = { inRadio: true, state };
        return (
          <Provider token={RadioContext} value={contextValue}>
            {local.children === undefined ? (
              <>
                <RadioContent>
                  <RadioControl>
                    <RadioIndicator />
                  </RadioControl>
                  {local.label}
                </RadioContent>
                {local.description !== undefined && <DescriptionRoot>{local.description}</DescriptionRoot>}
              </>
            ) : typeof local.children === "function" && !isSlot(local.children) ? (
              (local.children as (v: RadioFieldRenderProps) => Content)(state)
            ) : (
              (local.children as Content)
            )}
          </Provider>
        );
      }}
    </RadioFieldPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Radio.Content — the clickable `RadioButton` label wrapping the control + `Label`.
 * Keep `Description`/`FieldError` as siblings of `Radio.Content`.
 * -----------------------------------------------------------------------------------------------*/
interface RadioContentProps extends RadioButtonPrimitiveProps {}

const RadioContent = (props: RadioContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(RadioContext);
  const classOf = (): string | ((values: RadioButtonRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.content());
  const cls = hasLiveProp(local, ["class"]) ? (values: RadioButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <RadioButtonPrimitive data-slot="radio-content" {...(rest as object)} class={cls as never}>
      {(state: RadioButtonRenderProps) => (
        <Provider token={LabelContext} value={LABEL_SPAN_CONTEXT}>
          {typeof local.children === "function" && !isSlot(local.children)
            ? (local.children as (v: RadioButtonRenderProps) => Content)(state)
            : (local.children as Content)}
        </Provider>
      )}
    </RadioButtonPrimitive>
  );
};

/* -----------------------------------------------------------------------------------------------*/

interface RadioControlProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type RadioControlSpanProps = RadioControlProps & Omit<JSX.IntrinsicElements["span"], keyof RadioControlProps>;

const RadioControl = <E extends keyof JSX.IntrinsicElements = "span">(props: RadioControlProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as RadioControlSpanProps, ["children", "class"]);
  const context = useContext(RadioContext);

  return (
    <dom.span class={composeSlotClassName(slotsOf(context)?.control, local.class)} data-slot="radio-control" {...rest}>
      {local.children}
    </dom.span>
  );
};

/* -----------------------------------------------------------------------------------------------*/

interface RadioIndicatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content | ((props: RadioFieldRenderProps) => Content);
  class?: string;
}

type RadioIndicatorSpanProps = RadioIndicatorProps & Omit<JSX.IntrinsicElements["span"], keyof RadioIndicatorProps>;

// `span` props only (no element generic): a function child + the generic intrinsic `children` do not unify (TS2322), as list-box.
const RadioIndicator = (props: RadioIndicatorSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(RadioContext);
  const content = () =>
    typeof local.children === "function" && !isSlot(local.children)
      ? (local.children as (v: RadioFieldRenderProps) => Content)(context.state ?? ({} as RadioFieldRenderProps))
      : (local.children as Content);

  return (
    <dom.span aria-hidden="true" class={composeSlotClassName(slotsOf(context)?.indicator, local.class)} data-slot="radio-indicator" {...rest}>
      {content()}
    </dom.span>
  );
};

/* ----------------------------------------------------------------------------------------------*/

export { RadioRoot, RadioContent, RadioControl, RadioIndicator, RadioContext };
export type { RadioRootProps, RadioContentProps, RadioControlProps, RadioIndicatorProps, RadioFieldRenderProps, RadioButtonRenderProps };
export type { RadioControlSpanProps, RadioIndicatorSpanProps };
