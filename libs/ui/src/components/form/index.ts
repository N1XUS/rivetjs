// Ported from HeroUI v3.2.6 packages/react/src/components/form/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof FormRoot>` → `FormRootProps`.
import { FormRoot } from "./form.tsx";
import type { FormRootProps } from "./form.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Form = Object.assign(FormRoot, {
  Root: FormRoot,
});

export type Form = {
  Props: FormRootProps;
  RootProps: FormRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { FormRoot };

export type { FormRootProps, FormRootProps as FormProps } from "./form.tsx";
