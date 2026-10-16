// Ported from HeroUI v3.2.6 packages/react/src/components/spinner/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof SpinnerRoot>` → the default-element prop type (`SpinnerRootSpanProps`); `@heroui/styles` → vendored `styles/`.
import type { SpinnerRootSpanProps } from "./spinner.tsx";
import { SpinnerRoot } from "./spinner.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Spinner = Object.assign(SpinnerRoot, {
  Root: SpinnerRoot,
});

export type Spinner = {
  Props: SpinnerRootSpanProps;
  RootProps: SpinnerRootSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { SpinnerRoot };

export type { SpinnerRootProps, SpinnerRootProps as SpinnerProps } from "./spinner.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { spinnerVariants } from "../../../styles/src/components/spinner/index.ts";

export type { SpinnerVariants } from "../../../styles/src/components/spinner/index.ts";
