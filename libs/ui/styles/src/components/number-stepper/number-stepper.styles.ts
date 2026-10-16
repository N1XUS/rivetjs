// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no number stepper). Feature set inspired by HeroUI Pro's
// public docs (NumberStepper `size` sm / md / lg); independent implementation on HeroUI tokens.
import "../../../out/number-stepper.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const numberStepperVariants = tv({
  defaultVariants: {
    size: "md",
  },
  slots: {
    base: "number-stepper",
    char: "number-stepper__char",
    decrementButton: "number-stepper__button number-stepper__decrement-button",
    display: "number-stepper__display",
    group: "number-stepper__group",
    incrementButton: "number-stepper__button number-stepper__increment-button",
    input: "number-stepper__input",
    value: "number-stepper__value",
  },
  variants: {
    size: {
      lg: {
        base: "number-stepper--lg",
      },
      md: {
        base: "number-stepper--md",
      },
      sm: {
        base: "number-stepper--sm",
      },
    },
  },
});

export type NumberStepperVariants = VariantProps<typeof numberStepperVariants>;
