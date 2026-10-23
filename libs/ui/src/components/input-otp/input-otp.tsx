// Ported from HeroUI v3.2.6 packages/react/src/components/input-otp/input-otp.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class` (the container, upstream `containerClassName={slots.base({ className })}`),
//   `inputClassName` → `inputClass` (the hidden input); `input-otp` (React) → the in-tree signals port
//   `../../vendor/input-otp/input-otp.tsx` (`OTPInput`, `OTPInputContext`); `react-aria-components/FieldError`'s
//   `FieldErrorContext` → `@rivetjs/cdk/form`; `@heroui/styles` → vendored `styles/`.
// - `InputOTPContext` carries plain data (`{ inOTP, variant, isDisabled, isInvalid }`, getters when the root's props are live;
//   resumable token `rv-ui-input-otp`, `{ isDisabled: false, isInvalid: false }` default) instead of the tv `slots`; parts look
//   the slots up in a module-level memo per `variant` (`slotsFor`), `undefined` outside an InputOTP (= upstream `slots?.x`).
// - `InputOTP.Slot` reads the primitive's `OTPInputContext` render props lazily (getters over signals): `data-active` /
//   `data-filled` and the value / caret children follow the input without a re-render; value and caret sit in `Show`s
//   (truthiness memo), so typing keeps the earlier slots' value nodes (React keeps them too: no replayed roll-in).
//   `dataAttr` inlined (`"true"` or absent).
// - `value` also takes a two-way `Signal<string>` (vendor port; upstream: a controlled string).
// - Live props (`splitLive`): `class` / `inputClass` / `variant` / `isDisabled` / `isInvalid` / validation props are read in
//   the JSX attributes / context getters, so a live value updates in place.
// - Shorthand (identity spec §4.2): no children = one Group with a Slot per `maxLength` position (read once at mount); groups
//   with separators keep the compound form.
import { FieldErrorContext } from "@rivetjs/cdk/form";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider, Show } from "@rivetjs/runtime/dom";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { InputOTPVariants } from "../../../styles/src/components/input-otp/index.ts";
import { inputOTPVariants } from "../../../styles/src/components/input-otp/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { hasLiveProp, splitLive } from "../../utils/live.tsx";
import { OTPInput, OTPInputContext } from "../../vendor/input-otp/input-otp.tsx";
import type { OTPInputBaseProps } from "../../vendor/input-otp/input-otp.tsx";

const EMPTY_VALIDATION_ERRORS: string[] = [];

/* -------------------------------------------------------------------------------------------------
 * Input OTP Context
 * -----------------------------------------------------------------------------------------------*/
interface InputOTPContext {
  /** Set inside an InputOTP (upstream: `slots`). */
  inOTP?: true;
  variant?: InputOTPVariants["variant"];
  isDisabled?: boolean;
  isInvalid?: boolean;
}

const InputOTPContext = createContext<InputOTPContext>({ isDisabled: false, isInvalid: false });

type InputOTPSlots = ReturnType<typeof inputOTPVariants>;

/** Module-level memo per `variant` (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, InputOTPSlots> = {};
const slotsFor = (variant: InputOTPVariants["variant"]): InputOTPSlots => (SLOTS[String(variant)] ??= inputOTPVariants({ variant }));

/** Upstream `use(InputOTPContext).slots`: `undefined` outside an InputOTP. */
const slotsOf = (context: InputOTPContext): InputOTPSlots | undefined => (context.inOTP ? slotsFor(context.variant) : undefined);

const dataAttr = (condition: boolean | undefined): "true" | undefined => (condition ? "true" : undefined);

/* -------------------------------------------------------------------------------------------------
 * Input OTP Root
 * -----------------------------------------------------------------------------------------------*/
type InputOTPRootProps = Omit<OTPInputBaseProps, "disabled" | "containerClass"> &
  InputOTPVariants & {
    isDisabled?: boolean;
    isInvalid?: boolean;
    validationErrors?: string[];
    validationDetails?: ValidityState;
    /** Class of the hidden input (upstream `inputClassName`). */
    inputClass?: string;
    /** Groups, Slots, Separators. Omitted: one Group with a Slot per `maxLength` position. */
    children?: JSX.Element | JSX.Element[];
  };

const InputOTPRoot = (props: InputOTPRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "inputClass", "isDisabled", "isInvalid", "validationDetails", "validationErrors", "variant", "children"]);

  const validationOf = () => ({
    isInvalid: local.isInvalid ?? false,
    validationErrors: local.validationErrors ?? EMPTY_VALIDATION_ERRORS,
    validationDetails: local.validationDetails as ValidityState,
  });
  const validation = hasLiveProp(local, ["isInvalid", "validationErrors", "validationDetails"]) ? validationOf : validationOf();

  // Getters only when a field is live (readers then follow it), plain data otherwise.
  const contextValue: InputOTPContext = hasLiveProp(local, ["variant", "isDisabled", "isInvalid"])
    ? {
        inOTP: true,
        get variant() {
          return local.variant;
        },
        get isDisabled() {
          return local.isDisabled ?? false;
        },
        get isInvalid() {
          return local.isInvalid ?? false;
        },
      }
    : { inOTP: true, variant: local.variant, isDisabled: local.isDisabled ?? false, isInvalid: local.isInvalid ?? false };

  // A function: Rivet JSX builds nodes eagerly, so the input is created inside the providers.
  const content = () => (
    <OTPInput
      // The OTP input package uses the `class` prop for the actual `input` element, which is not visible to the user.
      class={slotsFor(local.variant).input({ className: local.inputClass })}
      containerClass={slotsFor(local.variant).base({ className: local.class as string | undefined })}
      data-disabled={dataAttr(local.isDisabled)}
      data-invalid={dataAttr(local.isInvalid)}
      data-slot="input-otp"
      disabled={local.isDisabled ?? false}
      {...(rest as OTPInputBaseProps)}
    >
      {local.children === undefined ? (
        <InputOTPGroup>
          {Array.from({ length: (rest as { maxLength: number }).maxLength }, (_, index) => (
            <InputOTPSlot index={index} />
          ))}
        </InputOTPGroup>
      ) : (
        local.children
      )}
    </OTPInput>
  );

  return (
    <Provider token={InputOTPContext} value={contextValue}>
      <Provider token={FieldErrorContext} value={validation as never}>
        {content()}
      </Provider>
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Input OTP Group
 * -----------------------------------------------------------------------------------------------*/
interface InputOTPGroupProps extends Omit<JSX.IntrinsicElements["div"], "class"> {
  class?: string;
}

const InputOTPGroup = (props: InputOTPGroupProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(InputOTPContext);

  return <div class={composeSlotClassName(slotsOf(context)?.group, local.class)} data-slot="input-otp-group" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Input OTP Slot
 * -----------------------------------------------------------------------------------------------*/
interface InputOTPSlotProps extends Omit<JSX.IntrinsicElements["div"], "class" | "children"> {
  class?: string;
  index: number;
}

const InputOTPSlot = (props: InputOTPSlotProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "index"]);
  const context = useContext(InputOTPContext);
  const inputOTPContext = useContext(OTPInputContext);
  const slot = () => inputOTPContext?.slots?.[local.index];

  return (
    <div
      {...rest}
      class={composeSlotClassName(slotsOf(context)?.slot, local.class)}
      data-active={dataAttr(slot()?.isActive)}
      data-disabled={dataAttr(context.isDisabled)}
      data-filled={dataAttr(!!slot()?.char)}
      data-invalid={dataAttr(context.isInvalid)}
      data-slot="input-otp-slot"
    >
      {/* `Show` (truthiness memo), not a ternary: a ternary child re-runs on every `slots` change and would re-create the
          value (replaying its `slot-value-in` roll) and the caret (restarting its blink) on each keystroke. */}
      <Show when={!!slot()?.char}>
        {() => (
          <div class={slotsOf(context)?.slotValue()} data-slot="input-otp-slot-value">
            {slot()?.char}
          </div>
        )}
      </Show>
      <Show when={!!(slot()?.hasFakeCaret && slot()?.isActive)}>{() => <div class={slotsOf(context)?.caret()} data-slot="input-otp-caret" />}</Show>
    </div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Input OTP Separator
 * -----------------------------------------------------------------------------------------------*/
interface InputOTPSeparatorProps extends Omit<JSX.IntrinsicElements["div"], "class"> {
  class?: string;
}

const InputOTPSeparator = (props: InputOTPSeparatorProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(InputOTPContext);

  return <div class={composeSlotClassName(slotsOf(context)?.separator, local.class)} data-slot="input-otp-separator" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { InputOTPRoot, InputOTPGroup, InputOTPSlot, InputOTPSeparator, InputOTPContext };

export type { InputOTPRootProps, InputOTPGroupProps, InputOTPSlotProps, InputOTPSeparatorProps };
