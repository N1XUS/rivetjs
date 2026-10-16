// Ported from HeroUI v3.2.6 packages/react/src/components/error-message/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof ErrorMessageRoot>` → `ErrorMessageRootProps` (cdk part props; the root is not generic); `@heroui/styles` → vendored `styles/`.
import { ErrorMessageRoot } from "./error-message.tsx";
import type { ErrorMessageRootProps } from "./error-message.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ErrorMessage = Object.assign(ErrorMessageRoot, {
  Root: ErrorMessageRoot,
});

export type ErrorMessage = {
  Props: ErrorMessageRootProps;
  RootProps: ErrorMessageRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ErrorMessageRoot };

export type { ErrorMessageRootProps, ErrorMessageRootProps as ErrorMessageProps } from "./error-message.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { errorMessageVariants } from "../../../styles/src/components/error-message/index.ts";

export type { ErrorMessageVariants } from "../../../styles/src/components/error-message/index.ts";
