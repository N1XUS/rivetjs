// Rivet addition (no HeroUI v3.2.6 counterpart): a compact pill stepper with an animated value. Feature set inspired by HeroUI
// Pro's public docs (NumberStepper: `size` sm / md / lg, `formatOptions` + every NumberField prop; parts `.Group`, `.Value`
// (`format`, render-function children), `.DecrementButton`, `.IncrementButton`); independent implementation, Rivet-authored
// styles on HeroUI tokens.
// - Root = cdk `NumberField` (value / defaultValue / two-way Signal / onChange, minValue / maxValue / step, formatOptions, locale,
//   isDisabled / isReadOnly / isRequired / validate, Label / Description / FieldError, hidden form input, keyboard + wheel).
//   Context `rv-ui-number-stepper` `{ inStepper, size }`.
// - Group = cdk `Group`; buttons = cdk `Button` with `slot="decrement"` / `"increment"` (the NumberField disables them at the
//   bounds; default icons lucide `Minus` / `Plus`; any children replace them).
// - Value = the real cdk `Input` (spinbutton: typing, arrows, Home / End, a11y) under an `aria-hidden` display. The input
//   text is transparent and the display shows the committed value (`formattedValue`), one span per character (`<For>`
//   keyed by index + character: a changed character is a new span, which plays the CSS roll-in; reduced motion: none),
//   also while the input is focused (a stepper press focuses it, React Aria). Only while the user edits the text
//   (`data-editing` on the wrapper: typing / IME / caret placement; cleared by a step, Enter or blur) the raw input text
//   shows; the edit rolls in on commit. Rows rendered on the server carry no `data-roll`, so nothing animates at load.
//   `format(value)` replaces the displayed text; a function child renders the display itself (gets `{ value, text }`).
// - Rivet addition (identity spec §4.2): no children = Group(DecrementButton, Value, IncrementButton), the compound form.
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import type { PressEvent } from "@rivetjs/cdk/interactions/press";
import { Group as GroupPrimitive } from "@rivetjs/cdk/group";
import type { GroupProps as GroupPrimitiveProps, GroupRenderProps } from "@rivetjs/cdk/group";
import { Input as InputPrimitive } from "@rivetjs/cdk/input";
import type { InputProps as InputPrimitiveProps, InputRenderProps } from "@rivetjs/cdk/input";
import { formattedValue } from "@rivetjs/cdk/number";
import { NumberField as NumberFieldPrimitive, NumberFieldStateContext } from "@rivetjs/cdk/number-field";
import type { NumberFieldProps as NumberFieldPrimitiveProps, NumberFieldRenderProps } from "@rivetjs/cdk/number-field";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { For, Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";
import { Minus, Plus } from "lucide";

import type { NumberStepperVariants } from "../../../styles/src/components/number-stepper/index.ts";
import { numberStepperVariants } from "../../../styles/src/components/number-stepper/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * NumberStepper Context
 * -----------------------------------------------------------------------------------------------*/
interface NumberStepperContext {
  /** Set inside a NumberStepper. */
  inStepper?: true;
  size?: NumberStepperVariants["size"];
}

const NumberStepperContext = createContext<NumberStepperContext>({});

type Slots = ReturnType<typeof numberStepperVariants>;

/** Module-level memo per `size` (tv slot functions are pure). */
const SLOTS: Record<string, Slots> = {};
const slotsFor = (size: NumberStepperVariants["size"]): Slots => (SLOTS[String(size)] ??= numberStepperVariants({ size }));
const slotsOf = (context: NumberStepperContext): Slots => slotsFor(context.size);

/* -------------------------------------------------------------------------------------------------
 * NumberStepper Root
 * -----------------------------------------------------------------------------------------------*/
interface NumberStepperRootProps extends NumberFieldPrimitiveProps, NumberStepperVariants {}

const NumberStepperRoot = (props: NumberStepperRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "size"]);
  const contextValue: NumberStepperContext = hasLiveProp(local, ["size"])
    ? {
        inStepper: true,
        get size() {
          return local.size;
        },
      }
    : { inStepper: true, size: local.size };
  const classOf = (): string | ((values: NumberFieldRenderProps) => string) => composeTwRenderProps(local.class as never, slotsFor(local.size).base());
  const cls = hasLiveProp(local, ["class", "size"]) ? (values: NumberFieldRenderProps) => renderClass(classOf(), values) : classOf();

  // A function: Rivet JSX builds nodes eagerly, so the field is created inside the provider.
  const content = () => (
    <NumberFieldPrimitive data-slot="number-stepper" {...(rest as object)} class={cls as never}>
      {local.children === undefined ? (
        <NumberStepperGroup>
          <NumberStepperDecrementButton />
          <NumberStepperValue />
          <NumberStepperIncrementButton />
        </NumberStepperGroup>
      ) : (
        (local.children as Content)
      )}
    </NumberFieldPrimitive>
  );
  return (
    <Provider token={NumberStepperContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * NumberStepper Group
 * -----------------------------------------------------------------------------------------------*/
interface NumberStepperGroupProps extends GroupPrimitiveProps {}

const NumberStepperGroup = (props: NumberStepperGroupProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(NumberStepperContext);
  const classOf = (): string | ((values: GroupRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context).group());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, ["size"]) ? (values: GroupRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <GroupPrimitive data-slot="number-stepper-group" {...(rest as object)} class={cls as never}>
      {local.children as Content}
    </GroupPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * NumberStepper Value
 * -----------------------------------------------------------------------------------------------*/
/** Accessors a Value function child gets. */
interface NumberStepperValueRenderProps {
  /** The committed number (`null` when empty). */
  value: () => number | null;
  /** The displayed text (`format(value)` or the field's formatted text). */
  text: () => string;
}

interface NumberStepperValueProps extends Omit<InputPrimitiveProps, "children"> {
  /** Formats the displayed value (the input keeps the field's own formatting for editing). */
  format?: (value: number | null) => string;
  /** Custom display, or a function of the value accessors. */
  children?: Content | ((values: NumberStepperValueRenderProps) => Content);
  /** Classes of the wrapper (`span.number-stepper__value`); `class` goes to the input. */
  wrapperClass?: string;
}

/**
 * Raw input text vs the animated display (user bug 2026-10-09: a stepper press focuses the input, React Aria, and the
 * display switched off on mere focus). The Value wrapper carries `data-editing` only while the user edits the text:
 * typing / IME / paste (`beforeinput`, `compositionstart`), caret moves and selection by keyboard, a pointer press in the
 * text. A step (buttons, ArrowUp / ArrowDown / PageUp / PageDown / Home / End, wheel), a commit (Enter) and blur clear
 * it, so the changed characters roll in again while the input keeps focus. A DOM attribute, no state: nothing to resume.
 */
function markEditing(wrapper: Element | null | undefined, on: boolean): void {
  if (!wrapper) return;
  if (on) wrapper.setAttribute("data-editing", "true");
  else wrapper.removeAttribute("data-editing");
}

/** The Value wrapper around an event's target (capture listeners: found from the target, not `currentTarget`). */
const valueOf = (event: Event): Element | null => (event.target as Element).closest("[data-slot=number-stepper-value]");
const editStart = (event: Event): void => markEditing(valueOf(event), true);
const editEnd = (event: Event): void => markEditing(valueOf(event), false);

const STEP_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", "Enter"]);
const CARET_KEYS = new Set(["ArrowLeft", "ArrowRight"]);

function valueKeyDown(event: KeyboardEvent): void {
  if (STEP_KEYS.has(event.key)) editEnd(event);
  else if (CARET_KEYS.has(event.key) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a")) editStart(event);
}

/** Text edits (typing, paste, delete, undo); Enter's `insertLineBreak` (Chrome fires one after the keydown) commits. */
function valueBeforeInput(event: InputEvent): void {
  if (event.inputType !== "insertLineBreak" && event.inputType !== "insertParagraph") editStart(event);
}

function valuePointerDown(event: PointerEvent): void {
  if ((event.target as Element).localName === "input") editStart(event);
}

/** A stepper button press (pointer, keyboard or touch) is a step: the display shows the new value animated. */
function stepPressStart(event: { target: Element }): void {
  markEditing(event.target.closest("[data-slot=number-stepper]")?.querySelector("[data-slot=number-stepper-value]"), false);
}

const NumberStepperValue = (props: NumberStepperValueProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "format", "wrapperClass"]);
  const context = useContext(NumberStepperContext);
  const state = useContext(NumberFieldStateContext);
  const format = local.format;
  // The committed value (not the text being typed): an edit rolls in when it is committed.
  const text = (): string => (format ? format(state ? state.value() : null) : state ? formattedValue(state) : "");
  const value = (): number | null => (state ? state.value() : null);
  const classOf = (): string | ((values: InputRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context).input());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, ["size"]) ? (values: InputRenderProps) => renderClass(classOf(), values) : classOf();
  const children = local.children;
  const chars = (): string[] => Array.from(text());
  const charClass = slotsOf(context).char();

  const display = () =>
    children == null ? (
      <For each={chars} by={(ch: string, i: number) => `${i}:${ch}`}>
        {(ch: () => string) => (
          <span class={charClass} data-slot="number-stepper-char" data-roll={typeof document !== "undefined" || undefined}>
            {ch()}
          </span>
        )}
      </For>
    ) : typeof children === "function" && !isSlot(children) ? (
      (children as (v: NumberStepperValueRenderProps) => Content)({ value, text })
    ) : (
      (children as Content)
    );

  return (
    <span
      class={composeSlotClassName(slotsOf(context).value, local.wrapperClass)}
      data-slot="number-stepper-value"
      onBeforeInputCapture={(e) => valueBeforeInput(e)}
      onCompositionStartCapture={(e) => editStart(e)}
      onKeyDownCapture={(e) => valueKeyDown(e)}
      onPointerDownCapture={(e) => valuePointerDown(e)}
      onWheelCapture={(e) => editEnd(e)}
      onFocusOutCapture={(e) => editEnd(e)}
    >
      <InputPrimitive data-slot="number-stepper-input" {...(rest as object)} class={cls as never} />
      <span aria-hidden="true" class={slotsOf(context).display()} data-slot="number-stepper-display">
        {display()}
      </span>
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * NumberStepper Buttons
 * -----------------------------------------------------------------------------------------------*/
interface NumberStepperButtonProps extends Omit<ButtonPrimitiveProps, "slot"> {}

const NumberStepperDecrementButton = (props: NumberStepperButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "onPressStart"]);
  const onPressStart = local.onPressStart;
  const context = useContext(NumberStepperContext);
  const classOf = (): string | ((values: ButtonRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context).decrementButton());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, ["size"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive
      data-slot="number-stepper-decrement-button"
      slot="decrement"
      {...(rest as object)}
      class={cls as never}
      onPressStart={(e: PressEvent) => {
        stepPressStart(e);
        onPressStart?.(e);
      }}
    >
      {(local.children as Content) ?? <Icon data-slot="number-stepper-decrement-icon" icon={Minus} />}
    </ButtonPrimitive>
  );
};

const NumberStepperIncrementButton = (props: NumberStepperButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "onPressStart"]);
  const onPressStart = local.onPressStart;
  const context = useContext(NumberStepperContext);
  const classOf = (): string | ((values: ButtonRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context).incrementButton());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, ["size"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive
      data-slot="number-stepper-increment-button"
      slot="increment"
      {...(rest as object)}
      class={cls as never}
      onPressStart={(e: PressEvent) => {
        stepPressStart(e);
        onPressStart?.(e);
      }}
    >
      {(local.children as Content) ?? <Icon data-slot="number-stepper-increment-icon" icon={Plus} />}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { NumberStepperRoot, NumberStepperGroup, NumberStepperValue, NumberStepperDecrementButton, NumberStepperIncrementButton, NumberStepperContext };
export type {
  NumberStepperRootProps,
  NumberStepperGroupProps,
  NumberStepperValueProps,
  NumberStepperValueRenderProps,
  NumberStepperButtonProps,
  NumberFieldRenderProps as NumberStepperRenderProps,
};
