// Rivet-authored: subtle inline character entrances.
import "../../../out/streaming-text.css";
import type {VariantProps} from "tailwind-variants";
import {tv} from "../../utils/tv.ts";

export const streamingTextVariants = tv({
  slots: {
    base: "streaming-text",
    character: "streaming-text__character",
  },
});
export type StreamingTextVariants = VariantProps<typeof streamingTextVariants>;
