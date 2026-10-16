// Ported from HeroUI v3.2.6 packages/styles/src/components/input-otp/input-otp.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/input-otp.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const inputOTPVariants = tv({
  defaultVariants: {
    variant: "primary",
  },
  slots: {
    base: "input-otp",
    caret: "input-otp__caret",
    group: "input-otp__group",
    input: "input-otp__input",
    separator: "input-otp__separator",
    slot: "input-otp__slot",
    slotValue: "input-otp__slot-value",
  },
  variants: {
    variant: {
      primary: {
        base: "input-otp--primary",
      },
      secondary: {
        base: "input-otp--secondary",
      },
    },
  },
});

export type InputOTPVariants = VariantProps<typeof inputOTPVariants>;
