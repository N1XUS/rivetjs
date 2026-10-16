// Ported from HeroUI v3.2.6 packages/react/src/components/textarea/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof TextAreaRoot>` → `TextAreaRootProps`; `@heroui/styles` → vendored `styles/`.
import { TextAreaRoot } from "./textarea.tsx";
import type { TextAreaRootProps } from "./textarea.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const TextArea = Object.assign(TextAreaRoot, {
  Root: TextAreaRoot,
});

export type TextArea = {
  Props: TextAreaRootProps;
  RootProps: TextAreaRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { TextAreaRoot };

export type { TextAreaRootProps, TextAreaRootProps as TextAreaProps } from "./textarea.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { textAreaVariants } from "../../../styles/src/components/textarea/index.ts";

export type { TextAreaVariants } from "../../../styles/src/components/textarea/index.ts";
