// Ported from HeroUI v3.2.6 packages/react/src/components/button/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof ButtonRoot>` → `ButtonRootProps`; `BUTTON_GROUP_CHILD` comes from `../button-group/button-group-context.ts`
// (upstream: `../button-group`); `@heroui/styles` → vendored `styles/`.
import { BUTTON_GROUP_CHILD } from "../button-group/button-group-context.ts";
import { ButtonRoot } from "./button.tsx";
import type { ButtonRootProps } from "./button.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Button = Object.assign(ButtonRoot, {
  Root: ButtonRoot,
});

export type Button = {
  Props: ButtonRootProps;
  RootProps: ButtonRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ButtonRoot };

export type { ButtonRootProps, ButtonRootProps as ButtonProps } from "./button.tsx";

export { BUTTON_GROUP_CHILD };

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { buttonVariants } from "../../../styles/src/components/button/index.ts";

export type { ButtonVariants } from "../../../styles/src/components/button/index.ts";
