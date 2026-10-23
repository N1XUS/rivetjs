// Ported from HeroUI v3.2.6 packages/react/src/components/switch/switch.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/{Switch,Label}` → `@rivetjs/cdk/{switch,label}`
//   (`SwitchField` / `SwitchButton`, accessor render props: `state.isSelected()`); `@heroui/styles` → vendored `styles/`.
// - `SwitchContext` (resumable `rv-ui-switch`, `{}` default) carries `{ inSwitch, size, state }` instead of `{ slots, state }`:
//   slots from a module-level memo per size (`slotsFor`); `state` = the cdk field render props (accessors).
// - Function children (`typeof children === "function"`) → `!isSlot(children)` (Rivet JSX children are compiler slots); a
//   function child of a span part gets the field state (accessors).
// - span parts: generic `dom.span` (`render` prop) as upstream.
// - Live `class` / `size` → render-prop class functions (the composed class is a local: it reaches the cdk part as a plain value); `isSelected` / `isDisabled` are
//   forwarded as getters (cdk keeps them live).
import { SwitchButton as SwitchButtonPrimitive, SwitchField as SwitchFieldPrimitive } from "@rivetjs/cdk/switch";
import type {
  SwitchButtonProps as SwitchButtonPrimitiveProps,
  SwitchButtonRenderProps,
  SwitchFieldProps as SwitchFieldPrimitiveProps,
  SwitchFieldRenderProps,
} from "@rivetjs/cdk/switch";
import { LabelContext } from "@rivetjs/cdk/label";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";

import type { SwitchVariants } from "../../../styles/src/components/switch/index.ts";
import { switchVariants } from "../../../styles/src/components/switch/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { DEV } from "#dev";

const LABEL_SPAN_CONTEXT = { elementType: "span" as const };

interface SwitchContext {
  /** Set inside a Switch (upstream: `slots`). */
  inSwitch?: true;
  size?: SwitchVariants["size"];
  state?: SwitchFieldRenderProps;
}

const SwitchContext = createContext<SwitchContext>({});

type SwitchSlots = ReturnType<typeof switchVariants>;

/** Module-level memo (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, SwitchSlots> = {};
const slotsFor = (size: SwitchVariants["size"]): SwitchSlots => (SLOTS[String(size)] ??= switchVariants({ size }));

/** Upstream `use(SwitchContext).slots`: `undefined` outside a Switch. */
const slotsOf = (context: SwitchContext): SwitchSlots | undefined => (context.inSwitch ? slotsFor(context.size) : undefined);

/* -------------------------------------------------------------------------------------------------
 * Switch (Field) — React Aria `SwitchField`.
 * -----------------------------------------------------------------------------------------------*/
interface SwitchRootProps extends SwitchFieldPrimitiveProps, SwitchVariants {
  /** Shorthand (no children): the label next to the control (renders Content > Switch.Control > Switch.Thumb + label). */
  label?: Content;
  /** Shorthand (no children): a Description under the label. */
  description?: Content;
}

const SwitchRoot = (props: SwitchRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "description", "label", "size", "isSelected", "isDisabled"]);
  if (DEV && local.children !== undefined) DEV.shorthandIgnored("Switch", local, ["label", "description"]);
  const live = hasLiveProp(local, ["class", "size"]);
  const classOf = (): string | ((values: SwitchFieldRenderProps) => string) => composeTwRenderProps(local.class as never, slotsFor(local.size).base());
  const cls = live ? (values: SwitchFieldRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <SwitchFieldPrimitive
      data-slot="switch"
      {...(rest as Omit<SwitchFieldPrimitiveProps, "children" | "class">)}
      class={cls as never}
      isDisabled={local.isDisabled as never}
      isSelected={local.isSelected as never}
    >
      {(state: SwitchFieldRenderProps) => {
        const contextValue: SwitchContext = live
          ? {
              inSwitch: true,
              get size() {
                return local.size;
              },
              state,
            }
          : { inSwitch: true, size: local.size, state };
        return (
          <Provider token={SwitchContext} value={contextValue}>
            {local.children === undefined ? (
              <>
                <SwitchContent>
                  <SwitchControl>
                    <SwitchThumb />
                  </SwitchControl>
                  {local.label}
                </SwitchContent>
                {local.description !== undefined && <DescriptionRoot>{local.description}</DescriptionRoot>}
              </>
            ) : typeof local.children === "function" && !isSlot(local.children) ? (
              (local.children as (v: SwitchFieldRenderProps) => Content)(state)
            ) : (
              (local.children as Content)
            )}
          </Provider>
        );
      }}
    </SwitchFieldPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Switch.Content — the clickable `SwitchButton` label wrapping the control + `Label`.
 * Keep `Description`/`FieldError` as siblings of `Switch.Content`.
 * -----------------------------------------------------------------------------------------------*/
interface SwitchContentProps extends SwitchButtonPrimitiveProps {}

const SwitchContent = (props: SwitchContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(SwitchContext);
  const classOf = (): string | ((values: SwitchButtonRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.content());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, ["size"]) ? (values: SwitchButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <SwitchButtonPrimitive data-slot="switch-content" {...(rest as object)} class={cls as never}>
      {(state: SwitchButtonRenderProps) => (
        <Provider token={LabelContext} value={LABEL_SPAN_CONTEXT}>
          {typeof local.children === "function" && !isSlot(local.children)
            ? (local.children as (v: SwitchButtonRenderProps) => Content)(state)
            : (local.children as Content)}
        </Provider>
      )}
    </SwitchButtonPrimitive>
  );
};

/* -----------------------------------------------------------------------------------------------*/

interface SwitchControlProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type SwitchControlSpanProps = SwitchControlProps & Omit<JSX.IntrinsicElements["span"], keyof SwitchControlProps>;

const SwitchControl = <E extends keyof JSX.IntrinsicElements = "span">(props: SwitchControlProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SwitchControlSpanProps, ["children", "class"]);
  const context = useContext(SwitchContext);

  return (
    <dom.span class={composeSlotClassName(slotsOf(context)?.control, local.class)} data-slot="switch-control" {...rest}>
      {local.children}
    </dom.span>
  );
};

/* -----------------------------------------------------------------------------------------------*/

interface SwitchThumbProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type SwitchThumbSpanProps = SwitchThumbProps & Omit<JSX.IntrinsicElements["span"], keyof SwitchThumbProps>;

const SwitchThumb = <E extends keyof JSX.IntrinsicElements = "span">(props: SwitchThumbProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SwitchThumbSpanProps, ["children", "class"]);
  const context = useContext(SwitchContext);

  return (
    <dom.span class={composeSlotClassName(slotsOf(context)?.thumb, local.class)} data-slot="switch-thumb" {...rest}>
      {local.children}
    </dom.span>
  );
};

/* -----------------------------------------------------------------------------------------------*/

interface SwitchIconProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type SwitchIconSpanProps = SwitchIconProps & Omit<JSX.IntrinsicElements["span"], keyof SwitchIconProps>;

const SwitchIcon = <E extends keyof JSX.IntrinsicElements = "span">(props: SwitchIconProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SwitchIconSpanProps, ["children", "class"]);
  const context = useContext(SwitchContext);

  return (
    <dom.span class={composeSlotClassName(slotsOf(context)?.icon, local.class)} data-slot="switch-icon" {...rest}>
      {local.children}
    </dom.span>
  );
};

/* ----------------------------------------------------------------------------------------------*/

export { SwitchRoot, SwitchContent, SwitchControl, SwitchThumb, SwitchIcon, SwitchContext };
export type { SwitchRootProps, SwitchContentProps, SwitchControlProps, SwitchThumbProps, SwitchIconProps, SwitchFieldRenderProps, SwitchButtonRenderProps };
export type { SwitchControlSpanProps, SwitchThumbSpanProps, SwitchIconSpanProps };
