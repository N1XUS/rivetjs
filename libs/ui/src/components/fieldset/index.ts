// Ported from HeroUI v3.2.6 packages/react/src/components/fieldset/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the default-element prop types (`../../../CLAUDE.md` port pattern: generic parts); `@heroui/styles` →
// vendored `styles/`.
import { FieldGroup, FieldsetActions, FieldsetLegend, FieldsetRoot } from "./fieldset.tsx";
import type { FieldGroupDivProps, FieldsetActionsDivProps, FieldsetLegendLegendProps, FieldsetRootFieldsetProps } from "./fieldset.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Fieldset = Object.assign(FieldsetRoot, {
  Root: FieldsetRoot,
  Legend: FieldsetLegend,
  Group: FieldGroup,
  Actions: FieldsetActions,
});

export type Fieldset = {
  Props: FieldsetRootFieldsetProps;
  RootProps: FieldsetRootFieldsetProps;
  LegendProps: FieldsetLegendLegendProps;
  GroupProps: FieldGroupDivProps;
  ActionsProps: FieldsetActionsDivProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { FieldsetRoot, FieldsetLegend, FieldGroup, FieldsetActions };

export type { FieldsetRootProps, FieldsetRootProps as FieldsetProps, FieldsetLegendProps, FieldGroupProps, FieldsetActionsProps } from "./fieldset.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { fieldsetVariants } from "../../../styles/src/components/fieldset/index.ts";

export type { FieldsetVariants } from "../../../styles/src/components/fieldset/index.ts";
