// Rivet addition (no HeroUI v3.2.6 counterpart): a styled native `<select>` field. Feature set inspired by HeroUI Pro's public
// docs (NativeSelect: `variant` primary / secondary, `fullWidth`; parts `.Trigger` (positioned wrapper + select),
// `.Indicator`, `.Option`, `.OptGroup`; composes with Label / Description / FieldError); independent implementation,
// Rivet-authored styles on HeroUI field tokens.
// - Root = cdk `TextField` (`@rivetjs/cdk/text-field`): value / defaultValue / onChange / name / isRequired / isInvalid /
//   isDisabled / validate / validationBehavior, Label `for`, Description + FieldError ids; the select is
//   `@rivetjs/cdk/native-select` (takes the field's input bag: real `<select>`, native validation, form reset, mobile pickers).
// - `NativeSelectContext` (resumable `rv-ui-native-select`, `{}` default) carries plain data `{ inNativeSelect, variant,
//   fullWidth }` (getters when live); slots come from a module-level memo per `variant|fullWidth`.
// - Indicator: an HTML `<select>` cannot hold non-option content, so `.Trigger` renders its children inside the select and the
//   indicator next to it through the `indicator` prop (default `<NativeSelect.Indicator />` = the morph chevron; `null` hides
//   it). Pro writes `.Indicator` as a Trigger child: here it is `indicator={<NativeSelect.Indicator>…</NativeSelect.Indicator>}`.
// - Shorthand (identity spec §4.2): no children = Label (`label`) + Trigger with one Option per `items` entry + Description
//   (`description`) + FieldError (`errorMessage`), the compound form's markup; `items` is a keyed `<For>` by
//   `value` (live). Explicit `children` win: the shorthand props are ignored (dev warning, `utils/shorthand.ts`).
import {
  NativeSelect as NativeSelectPrimitive,
  NativeSelectOptGroup as OptGroupPrimitive,
  NativeSelectOption as OptionPrimitive,
} from "@rivetjs/cdk/native-select";
import type {
  InputRenderProps,
  NativeSelectOptGroupProps as OptGroupPrimitiveProps,
  NativeSelectOptionProps as OptionPrimitiveProps,
  NativeSelectProps as NativeSelectPrimitiveProps,
} from "@rivetjs/cdk/native-select";
import { TextField as TextFieldPrimitive } from "@rivetjs/cdk/text-field";
import type { TextFieldProps as TextFieldPrimitiveProps, TextFieldRenderProps } from "@rivetjs/cdk/text-field";
import { createContext, useContext } from "@rivetjs/reactivity";
import { For, Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { isSlot } from "@rivetjs/runtime/slot";

import type { NativeSelectVariants } from "../../../styles/src/components/native-select/index.ts";
import { nativeSelectVariants } from "../../../styles/src/components/native-select/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { FieldErrorRoot, type FieldErrorRootProps } from "../field-error/field-error.tsx";
import { LabelRoot } from "../label/label.tsx";
import { DEV } from "#dev";
import { warnShorthandIgnored } from "../../utils/shorthand.ts";

/* -------------------------------------------------------------------------------------------------
 * NativeSelect Context
 * -----------------------------------------------------------------------------------------------*/
interface NativeSelectContext {
  /** Set inside a NativeSelect. */
  inNativeSelect?: true;
  variant?: NativeSelectVariants["variant"];
  fullWidth?: NativeSelectVariants["fullWidth"];
}

const NativeSelectContext = resumableContext(createContext<NativeSelectContext>({}, { id: "rv-ui-native-select" }));

type NativeSelectSlots = ReturnType<typeof nativeSelectVariants>;

/** Module-level memo per `variant|fullWidth` (tv slot functions are pure). */
const SLOTS: Record<string, NativeSelectSlots> = {};
const slotsFor = (variant: NativeSelectVariants["variant"], fullWidth: NativeSelectVariants["fullWidth"]): NativeSelectSlots =>
  (SLOTS[`${variant}|${fullWidth}`] ??= nativeSelectVariants({ variant, fullWidth }));

/** Plain slots (default variant) outside a NativeSelect, so the parts stay usable on their own. */
const slotsOf = (context: NativeSelectContext): NativeSelectSlots => slotsFor(context.variant, context.fullWidth);

/* -------------------------------------------------------------------------------------------------
 * NativeSelect Root
 * -----------------------------------------------------------------------------------------------*/
/** One option of the `items` shorthand. */
interface NativeSelectItem {
  value: string;
  label: string;
  isDisabled?: boolean;
}

interface NativeSelectRootProps extends Omit<TextFieldPrimitiveProps, "children">, NativeSelectVariants {
  /** Label, Trigger, Description, FieldError; or a function of the field render props (accessors). */
  children?: Content | ((values: TextFieldRenderProps) => Content);
  /** Shorthand (no children): the field's Label. */
  label?: Content;
  /** Shorthand (no children): a Description under the select. */
  description?: Content;
  /** Shorthand (no children): the FieldError text (shown while the field is invalid). */
  errorMessage?: FieldErrorRootProps["children"];
  /** Shorthand (no children): one Option per item (live, keyed by `value`). */
  items?: readonly NativeSelectItem[];
}

const CONTEXT_PROPS = ["variant", "fullWidth"] as const;

const NativeSelectRoot = (props: NativeSelectRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "description", "errorMessage", "items", "label", "variant", "fullWidth"]);
  if (DEV && local.children !== undefined) warnShorthandIgnored("NativeSelect", local, ["label", "description", "errorMessage", "items"]);
  const contextValue: NativeSelectContext = hasLiveProp(local, CONTEXT_PROPS)
    ? {
        inNativeSelect: true,
        get variant() {
          return local.variant;
        },
        get fullWidth() {
          return local.fullWidth;
        },
      }
    : { inNativeSelect: true, variant: local.variant, fullWidth: local.fullWidth };
  const classOf = (): string | ((values: TextFieldRenderProps) => string) =>
    composeTwRenderProps(local.class as never, slotsFor(local.variant, local.fullWidth).base());
  const cls = hasLiveProp(local, ["class", ...CONTEXT_PROPS]) ? (values: TextFieldRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <TextFieldPrimitive data-slot="native-select" {...(rest as TextFieldPrimitiveProps)} class={cls as never}>
      {(values: TextFieldRenderProps) => (
        <Provider token={NativeSelectContext} value={contextValue}>
          {local.children === undefined ? (
            <>
              {local.label !== undefined && <LabelRoot>{local.label}</LabelRoot>}
              <NativeSelectTrigger>
                <For each={() => local.items ?? []} by={(item: NativeSelectItem) => item.value}>
                  {(item: () => NativeSelectItem) => (
                    <NativeSelectOption value={item().value} disabled={item().isDisabled}>
                      {item().label}
                    </NativeSelectOption>
                  )}
                </For>
              </NativeSelectTrigger>
              {local.description !== undefined && <DescriptionRoot>{local.description}</DescriptionRoot>}
              {local.errorMessage !== undefined && <FieldErrorRoot>{local.errorMessage}</FieldErrorRoot>}
            </>
          ) : typeof local.children === "function" && !isSlot(local.children) ? (
            (local.children as (v: TextFieldRenderProps) => Content)(values)
          ) : (
            (local.children as Content)
          )}
        </Provider>
      )}
    </TextFieldPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * NativeSelect Trigger
 * -----------------------------------------------------------------------------------------------*/
interface NativeSelectTriggerProps extends Omit<NativeSelectPrimitiveProps, "children"> {
  /** `.Option` / `.OptGroup` children (rendered inside the `<select>`). */
  children?: Content;
  /** Class of the positioned wrapper around the select and the indicator. */
  wrapperClass?: string;
  /** The indicator next to the select. @default <NativeSelect.Indicator /> (the morph chevron); `null` hides it. */
  indicator?: Content | null;
}

const NativeSelectTrigger = (props: NativeSelectTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "wrapperClass", "indicator"]);
  const context = useContext(NativeSelectContext);
  const classOf = (): string | ((values: InputRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context).select());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, CONTEXT_PROPS) ? (values: InputRenderProps) => renderClass(classOf(), values) : classOf();
  const indicator = local.indicator === undefined ? <NativeSelectIndicator /> : local.indicator;

  return (
    <dom.div class={composeSlotClassName(slotsOf(context).trigger, local.wrapperClass)} data-slot="native-select-trigger">
      <NativeSelectPrimitive data-slot="native-select-select" {...(rest as object)} class={cls as never}>
        {local.children}
      </NativeSelectPrimitive>
      {indicator}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * NativeSelect Indicator
 * -----------------------------------------------------------------------------------------------*/
interface NativeSelectIndicatorProps {
  /** Custom indicator content. @default the morph chevron (CSS bars, `morph-icon.css`) */
  children?: Content;
  class?: string;
}

type NativeSelectIndicatorSpanProps = NativeSelectIndicatorProps & Omit<JSX.IntrinsicElements["span"], keyof NativeSelectIndicatorProps>;

const NativeSelectIndicator = (props: NativeSelectIndicatorSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(NativeSelectContext);
  const cls = composeSlotClassName(slotsOf(context).indicator, local.class);
  if (local.children)
    return (
      <dom.span aria-hidden="true" {...(rest as {})} class={cls} data-slot="native-select-indicator">
        {local.children}
      </dom.span>
    );
  // Default = morph chevron (CSS bars, `morph-icon.css`, TW-149; folds up where the browser matches `select:open`).
  return <dom.span aria-hidden="true" class={[cls, "morph-chevron"].join(" ").trim()} data-slot="native-select-default-indicator" {...(rest as {})} />;
};

/* -------------------------------------------------------------------------------------------------
 * NativeSelect Option / OptGroup
 * -----------------------------------------------------------------------------------------------*/
type NativeSelectOptionProps = OptionPrimitiveProps;

const NativeSelectOption = (props: NativeSelectOptionProps): JSX.Element => {
  const context = useContext(NativeSelectContext);
  const { class: className, ...rest } = props;
  return <OptionPrimitive data-slot="native-select-option" {...rest} class={composeSlotClassName(slotsOf(context).option, className)} />;
};

type NativeSelectOptGroupProps = OptGroupPrimitiveProps;

const NativeSelectOptGroup = (props: NativeSelectOptGroupProps): JSX.Element => {
  const context = useContext(NativeSelectContext);
  const { class: className, ...rest } = props;
  return <OptGroupPrimitive data-slot="native-select-optgroup" {...rest} class={composeSlotClassName(slotsOf(context).optGroup, className)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { NativeSelectRoot, NativeSelectTrigger, NativeSelectIndicator, NativeSelectOption, NativeSelectOptGroup, NativeSelectContext };
export type {
  NativeSelectItem,
  NativeSelectRootProps,
  NativeSelectTriggerProps,
  NativeSelectIndicatorProps,
  NativeSelectIndicatorSpanProps,
  NativeSelectOptionProps,
  NativeSelectOptGroupProps,
  TextFieldRenderProps as NativeSelectRenderProps,
};
