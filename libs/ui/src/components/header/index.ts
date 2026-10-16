// Ported from HeroUI v3.2.6 packages/react/src/components/header/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof HeaderRoot>` → `HeaderRootProps` (cdk part props; the root is not generic); `@heroui/styles` → vendored `styles/`.
import { HeaderRoot } from "./header.tsx";
import type { HeaderRootProps } from "./header.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Header = HeaderRoot;

export type Header = {
  Props: HeaderRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { HeaderRoot };

export type { HeaderRootProps, HeaderRootProps as HeaderProps } from "./header.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { headerVariants } from "../../../styles/src/components/header/index.ts";
