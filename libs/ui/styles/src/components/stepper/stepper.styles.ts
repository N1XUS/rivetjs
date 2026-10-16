// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no stepper): tv() slots of @rivetjs/ui/stepper in the
// vendored format. Feature set inspired by HeroUI Pro's public Stepper docs (class / variable names); independent
// implementation. Behaviour = @rivetjs/cdk/stepper (port of Angular CDK stepper, MIT, © Google LLC).
import "../../../out/stepper.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const stepperVariants = tv({
  defaultVariants: {
    orientation: "horizontal",
    size: "md",
  },
  slots: {
    base: "stepper",
    content: "stepper__content",
    description: "stepper__description",
    icon: "stepper__icon",
    indicator: "stepper__indicator",
    separator: "stepper__separator",
    separatorFill: "stepper__separator-fill",
    separatorTrack: "stepper__separator-track",
    step: "stepper__step",
    stepButton: "stepper__step-button",
    title: "stepper__title",
  },
  variants: {
    orientation: {
      horizontal: {
        base: "stepper--horizontal",
      },
      vertical: {
        base: "stepper--vertical",
      },
    },
    size: {
      lg: {
        base: "stepper--lg",
      },
      md: {
        base: "stepper--md",
      },
      sm: {
        base: "stepper--sm",
      },
    },
  },
});

export type StepperVariants = VariantProps<typeof stepperVariants>;
