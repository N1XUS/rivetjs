// Rivet addition (no HeroUI v3.2.6 counterpart): press feedback layers (highlight, ripple, hold to confirm, progress) on
// `@rivetjs/cdk/button`; feature set inspired by HeroUI Pro's public Pressable Feedback docs, independent implementation (see
// `pressable-feedback.tsx`).
import {
  PressableFeedbackHighlight,
  PressableFeedbackHoldConfirm,
  PressableFeedbackProgressFeedback,
  PressableFeedbackRipple,
  PressableFeedbackRoot,
} from "./pressable-feedback.tsx";
import type {
  PressableFeedbackHighlightProps,
  PressableFeedbackHoldConfirmProps,
  PressableFeedbackProgressFeedbackProps,
  PressableFeedbackRippleProps,
  PressableFeedbackRootProps,
} from "./pressable-feedback.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const PressableFeedback = Object.assign(PressableFeedbackRoot, {
  Root: PressableFeedbackRoot,
  Highlight: PressableFeedbackHighlight,
  Ripple: PressableFeedbackRipple,
  HoldConfirm: PressableFeedbackHoldConfirm,
  ProgressFeedback: PressableFeedbackProgressFeedback,
});

export type PressableFeedback = {
  Props: PressableFeedbackRootProps;
  RootProps: PressableFeedbackRootProps;
  HighlightProps: PressableFeedbackHighlightProps;
  RippleProps: PressableFeedbackRippleProps;
  HoldConfirmProps: PressableFeedbackHoldConfirmProps;
  ProgressFeedbackProps: PressableFeedbackProgressFeedbackProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  PressableFeedbackRoot,
  PressableFeedbackHighlight,
  PressableFeedbackRipple,
  PressableFeedbackHoldConfirm,
  PressableFeedbackProgressFeedback,
} from "./pressable-feedback.tsx";
export type {
  PressableFeedbackRootProps,
  PressableFeedbackRootProps as PressableFeedbackProps,
  PressableFeedbackHighlightProps,
  PressableFeedbackRippleProps,
  PressableFeedbackHoldConfirmProps,
  PressableFeedbackProgressFeedbackProps,
} from "./pressable-feedback.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { pressableFeedbackVariants } from "../../../styles/src/components/pressable-feedback/index.ts";

export type { PressableFeedbackVariants } from "../../../styles/src/components/pressable-feedback/index.ts";
