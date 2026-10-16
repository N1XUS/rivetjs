// Ported from HeroUI v3.2.6 packages/react/src/components/input-otp/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
import { InputOTPGroup, InputOTPRoot, InputOTPSeparator, InputOTPSlot } from "./input-otp.tsx";
import type { InputOTPGroupProps, InputOTPRootProps, InputOTPSeparatorProps, InputOTPSlotProps } from "./input-otp.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const InputOTP = Object.assign(InputOTPRoot, {
  Root: InputOTPRoot,
  Group: InputOTPGroup,
  Slot: InputOTPSlot,
  Separator: InputOTPSeparator,
});

export type InputOTP = {
  Props: InputOTPRootProps;
  RootProps: InputOTPRootProps;
  GroupProps: InputOTPGroupProps;
  SlotProps: InputOTPSlotProps;
  SeparatorProps: InputOTPSeparatorProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { InputOTPGroup, InputOTPRoot, InputOTPSeparator, InputOTPSlot };

export type { InputOTPRootProps, InputOTPRootProps as InputOTPProps, InputOTPGroupProps, InputOTPSlotProps, InputOTPSeparatorProps } from "./input-otp.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { inputOTPVariants } from "../../../styles/src/components/input-otp/index.ts";

export type { InputOTPVariants } from "../../../styles/src/components/input-otp/index.ts";

//  ===================================
// Regular Expressions
//  ===================================
export const REGEXP_ONLY_DIGITS = "^\\d+$";
export const REGEXP_ONLY_CHARS = "^[a-zA-Z]+$";
export const REGEXP_ONLY_DIGITS_AND_CHARS = "^[a-zA-Z0-9]+$";
