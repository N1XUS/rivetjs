// Ported from HeroUI v3.2.6 packages/react/src/components/fieldset/fieldset.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; React types → Rivet JSX types; `@heroui/styles` → vendored `styles/`.
// - `FieldsetContext` carries `{ inFieldset: true }` instead of `{ slots }` (resumable token `rv-ui-fieldset`, `{}` default): fieldset has no
//   variants, so the parts read the module-level `SLOTS` (`fieldsetVariants({})` once) when inside a Fieldset and `undefined` slots
//   outside one (= upstream `slots?.x`: only the caller's `class`).
// - The disabled bridge: RAC `Provider values` → cdk `Provider` (`@rivetjs/cdk/slots`) with the same contexts (cdk `ButtonContext`,
//   `CheckboxGroupContext`, `LinkContext`, `RadioGroupContext`, `SliderContext`, `ToggleButtonContext`, `ToggleButtonGroupContext`).
//   `disabled` is read lazily: `data-disabled` and the bridge follow a live `disabled` (the children are re-created when it flips,
//   as React's differently shaped tree).
// - Root / parts generic over the element: props `XProps<E> & JSX.IntrinsicElements[E]` (no `Omit`, TS2590; `../../../CLAUDE.md` Known diffs).
import { ButtonContext } from "@rivetjs/cdk/button";
import { CheckboxGroupContext } from "@rivetjs/cdk/checkbox";
import { LinkContext } from "@rivetjs/cdk/link";
import { RadioGroupContext } from "@rivetjs/cdk/radio-group";
import { SliderContext } from "@rivetjs/cdk/slider";
import { Provider as RACProvider } from "@rivetjs/cdk/slots";
import { ToggleButtonContext } from "@rivetjs/cdk/toggle-button";
import { ToggleButtonGroupContext } from "@rivetjs/cdk/toggle-button-group";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { fieldsetVariants } from "../../../styles/src/components/fieldset/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Fieldset Context
 * -----------------------------------------------------------------------------------------------*/
type FieldsetContext = {
  /** Set inside a `Fieldset` (upstream: `slots`). */
  inFieldset?: true;
};

const FieldsetContext = createContext<FieldsetContext>({});

type FieldsetSlots = ReturnType<typeof fieldsetVariants>;

/** Upstream `useMemo(() => fieldsetVariants({}), [])`: the same pure slot functions for every Fieldset. */
const SLOTS: FieldsetSlots = fieldsetVariants({});

const slotsOf = (context: FieldsetContext): FieldsetSlots | undefined => (context.inFieldset ? SLOTS : undefined);

const IN_FIELDSET: FieldsetContext = { inFieldset: true };

/** The contexts a disabled fieldset forwards `isDisabled` through (upstream list). */
const DISABLED = { isDisabled: true };

/* -------------------------------------------------------------------------------------------------
 * Fieldset Root
 * -----------------------------------------------------------------------------------------------*/
interface FieldsetRootProps<E extends keyof JSX.IntrinsicElements = "fieldset"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type FieldsetRootFieldsetProps = FieldsetRootProps & Omit<JSX.IntrinsicElements["fieldset"], keyof FieldsetRootProps>;

const FieldsetRoot = <E extends keyof JSX.IntrinsicElements = "fieldset">(props: FieldsetRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as FieldsetRootFieldsetProps, ["children", "class"]);

  // Mirror native `<fieldset disabled>` as `data-disabled="true"` so the
  // existing `[data-disabled="true"] .label` (and similar) ancestor selectors
  // cascade disabled styling to descendant fields, just like a direct
  // `isDisabled` prop on TextField/Checkbox/etc. would.
  const isDisabled = () => (rest as { disabled?: unknown }).disabled === true;

  return (
    <Provider token={FieldsetContext} value={IN_FIELDSET}>
      <dom.fieldset class={SLOTS.base({ class: local.class })} data-disabled={isDisabled() || undefined} data-slot="fieldset" {...rest}>
        {isDisabled() ? (
          // Forward `isDisabled` through React Aria contexts so descendant
          // components stay consistent with the native `<fieldset disabled>`
          // behaviour. There are two reasons we need to do this manually:
          //
          // 1. Some primitives (Slider, RadioGroup, CheckboxGroup, ...) render
          //    as `<div>` so the browser does not propagate the fieldset's
          //    `disabled` attribute to them — without this, they would still
          //    look enabled and remain interactive.
          // 2. Other primitives (Button, ToggleButton, Link, ...) do get
          //    natively disabled by the browser, but React Aria's internal
          //    `isDisabled` state — which drives `data-disabled` and the
          //    `{isDisabled}` render prop — only updates from props/context.
          //    Without this, the button is unclickable but its render prop
          //    keeps returning `isDisabled: false`.
          <RACProvider
            values={[
              [ButtonContext, DISABLED],
              [CheckboxGroupContext, DISABLED],
              [LinkContext, DISABLED],
              [RadioGroupContext, DISABLED],
              [SliderContext, DISABLED],
              [ToggleButtonContext, DISABLED],
              [ToggleButtonGroupContext, DISABLED],
            ]}
          >
            {local.children}
          </RACProvider>
        ) : (
          local.children
        )}
      </dom.fieldset>
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Fieldset Legend
 * -----------------------------------------------------------------------------------------------*/
interface FieldsetLegendProps<E extends keyof JSX.IntrinsicElements = "legend"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type FieldsetLegendLegendProps = FieldsetLegendProps & Omit<JSX.IntrinsicElements["legend"], keyof FieldsetLegendProps>;

const FieldsetLegend = <E extends keyof JSX.IntrinsicElements = "legend">(props: FieldsetLegendProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as FieldsetLegendLegendProps, ["class"]);
  const context = useContext(FieldsetContext);

  return <dom.legend class={composeSlotClassName(slotsOf(context)?.legend, local.class)} data-slot="fieldset-legend" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Field Group
 * -----------------------------------------------------------------------------------------------*/
interface FieldGroupProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type FieldGroupDivProps = FieldGroupProps & Omit<JSX.IntrinsicElements["div"], keyof FieldGroupProps>;

const FieldGroup = <E extends keyof JSX.IntrinsicElements = "div">(props: FieldGroupProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as FieldGroupDivProps, ["class"]);
  const context = useContext(FieldsetContext);

  return <dom.div class={composeSlotClassName(slotsOf(context)?.fieldGroup, local.class)} data-slot="fieldset-field-group" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Field Actions
 * -----------------------------------------------------------------------------------------------*/
interface FieldsetActionsProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type FieldsetActionsDivProps = FieldsetActionsProps & Omit<JSX.IntrinsicElements["div"], keyof FieldsetActionsProps>;

const FieldsetActions = <E extends keyof JSX.IntrinsicElements = "div">(props: FieldsetActionsProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as FieldsetActionsDivProps, ["children", "class"]);
  const context = useContext(FieldsetContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.actions, local.class)} data-slot="fieldset-actions" {...rest}>
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { FieldsetRoot, FieldsetLegend, FieldGroup, FieldsetActions };

export type { FieldsetRootProps, FieldsetLegendProps, FieldGroupProps, FieldsetActionsProps };
export type { FieldsetRootFieldsetProps, FieldsetLegendLegendProps, FieldGroupDivProps, FieldsetActionsDivProps };
