// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no reasoning trace). Feature set inspired by HeroUI
// Pro's public ChainOfThought docs; independent implementation on HeroUI tokens.
import "../../../out/chain-of-thought.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const chainOfThoughtVariants = tv({
  slots: {
    base: "chain-of-thought",
    body: "chain-of-thought__body",
    content: "chain-of-thought__content",
    heading: "chain-of-thought__heading",
    indicator: "chain-of-thought__indicator",
    label: "chain-of-thought__label",
    step: "chain-of-thought__step",
    stepBody: "chain-of-thought__step-body",
    stepContent: "chain-of-thought__step-content",
    stepIcon: "chain-of-thought__step-icon",
    stepLabel: "chain-of-thought__step-label",
    stepMarker: "chain-of-thought__step-marker",
    steps: "chain-of-thought__steps",
    trigger: "chain-of-thought__trigger",
    triggerIcon: "chain-of-thought__trigger-icon",
  },
});

export type ChainOfThoughtVariants = VariantProps<typeof chainOfThoughtVariants>;
