// Ported from HeroUI v3.2.6 packages/react/src/components/textfield/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof TextFieldRoot>` → `TextFieldRootProps`; `@heroui/styles` → vendored `styles/`.
import { TextFieldRoot } from "./textfield.tsx";
import type { TextFieldRootProps } from "./textfield.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const TextField = Object.assign(TextFieldRoot, {
  Root: TextFieldRoot,
});

export type TextField = {
  Props: TextFieldRootProps;
  RootProps: TextFieldRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { TextFieldRoot };

export type { TextFieldRootProps, TextFieldRootProps as TextFieldProps } from "./textfield.tsx";

/* -------------------------------------------------------------------------------------------------
 * Context
 * -----------------------------------------------------------------------------------------------*/
export { TextFieldContext } from "./textfield-context.ts";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { textFieldVariants } from "../../../styles/src/components/textfield/index.ts";

export type { TextFieldVariants } from "../../../styles/src/components/textfield/index.ts";
