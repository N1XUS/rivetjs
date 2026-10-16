// Ported from HeroUI v3.2.6 packages/react/src/components/close-button/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof CloseButtonRoot>` → `CloseButtonRootProps`; `@heroui/styles` → vendored `styles/`.
import { CloseButtonRoot } from "./close-button.tsx";
import type { CloseButtonRootProps } from "./close-button.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const CloseButton = Object.assign(CloseButtonRoot, {
  Root: CloseButtonRoot,
});

export type CloseButton = {
  Props: CloseButtonRootProps;
  RootProps: CloseButtonRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { CloseButtonRoot };

export type { CloseButtonRootProps, CloseButtonRootProps as CloseButtonProps } from "./close-button.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { closeButtonVariants } from "../../../styles/src/components/close-button/index.ts";

export type { CloseButtonVariants } from "../../../styles/src/components/close-button/index.ts";
