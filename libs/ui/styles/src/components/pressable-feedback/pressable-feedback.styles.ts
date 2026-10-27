// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no pressable feedback). Feature set inspired by HeroUI
// Pro's public Pressable Feedback docs (`.pressable-feedback__*` parts); independent implementation on HeroUI tokens.
import "../../../out/pressable-feedback.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const pressableFeedbackVariants = tv({
  slots: {
    base: "pressable-feedback",
    highlight: "pressable-feedback__highlight",
    holdConfirm: "pressable-feedback__hold-confirm",
    progressFeedback: "pressable-feedback__progress-feedback",
    ripple: "pressable-feedback__ripple",
    rippleSurface: "pressable-feedback__ripple-surface",
  },
});

export type PressableFeedbackVariants = VariantProps<typeof pressableFeedbackVariants>;
