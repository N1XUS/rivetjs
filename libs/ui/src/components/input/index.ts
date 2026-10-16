// Ported from HeroUI v3.2.6 packages/react/src/components/input/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof InputRoot>` → `InputRootProps`; `@heroui/styles` → vendored `styles/`.
import { InputRoot } from "./input.tsx";
import type { InputRootProps } from "./input.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Input = Object.assign(InputRoot, {
  Root: InputRoot,
});

export type Input = {
  Props: InputRootProps;
  RootProps: InputRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { InputRoot };

export type { InputRootProps, InputRootProps as InputProps } from "./input.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { inputVariants } from "../../../styles/src/components/input/index.ts";

export type { InputVariants } from "../../../styles/src/components/input/index.ts";
