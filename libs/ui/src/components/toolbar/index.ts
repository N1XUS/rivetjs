// Ported from HeroUI v3.2.6 packages/react/src/components/toolbar/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof ToolbarRoot>` → `ToolbarRootProps`; `@heroui/styles` → vendored `styles/`.
import { ToolbarRoot } from "./toolbar.tsx";
import type { ToolbarRootProps } from "./toolbar.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Toolbar = Object.assign(ToolbarRoot, {
  Root: ToolbarRoot,
});

export type Toolbar = {
  Props: ToolbarRootProps;
  RootProps: ToolbarRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ToolbarRoot } from "./toolbar.tsx";

export type { ToolbarRootProps, ToolbarRootProps as ToolbarProps } from "./toolbar.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { toolbarVariants } from "../../../styles/src/components/toolbar/index.ts";

export type { ToolbarVariants } from "../../../styles/src/components/toolbar/index.ts";
