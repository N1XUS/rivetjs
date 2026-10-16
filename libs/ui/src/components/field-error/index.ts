// Ported from HeroUI v3.2.6 packages/react/src/components/field-error/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof FieldErrorRoot>` → `FieldErrorRootProps` (cdk part props; the root is not generic); `@heroui/styles` → vendored `styles/`.
import { FieldErrorRoot } from "./field-error.tsx";
import type { FieldErrorRootProps } from "./field-error.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const FieldError = Object.assign(FieldErrorRoot, {
  Root: FieldErrorRoot,
});

export type FieldError = {
  Props: FieldErrorRootProps;
  RootProps: FieldErrorRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { FieldErrorRoot };

export type { FieldErrorRootProps, FieldErrorRootProps as FieldErrorProps } from "./field-error.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { fieldErrorVariants } from "../../../styles/src/components/field-error/index.ts";

export type { FieldErrorVariants } from "../../../styles/src/components/field-error/index.ts";
