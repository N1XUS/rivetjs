// Ported from HeroUI v3.2.6 packages/react/src/components/empty-state/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof EmptyStateRoot>` → the default-element prop type (`EmptyStateRootDivProps`); `@heroui/styles` → vendored `styles/`.
import type { EmptyStateDescriptionProps, EmptyStateMediaProps, EmptyStatePartProps, EmptyStateRootDivProps, EmptyStateTitleProps } from "./empty-state.tsx";
import { EmptyStateContent, EmptyStateDescription, EmptyStateHeader, EmptyStateMedia, EmptyStateRoot, EmptyStateTitle } from "./empty-state.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const EmptyState = Object.assign(EmptyStateRoot, {
  Root: EmptyStateRoot,
  // Rivet addition (UI-PORT S7): structured parts
  Header: EmptyStateHeader,
  Media: EmptyStateMedia,
  Title: EmptyStateTitle,
  Description: EmptyStateDescription,
  Content: EmptyStateContent,
});

export type EmptyState = {
  Props: EmptyStateRootDivProps;
  RootProps: EmptyStateRootDivProps;
  PartProps: EmptyStatePartProps;
  MediaProps: EmptyStateMediaProps;
  TitleProps: EmptyStateTitleProps;
  DescriptionProps: EmptyStateDescriptionProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { EmptyStateRoot, EmptyStateHeader, EmptyStateMedia, EmptyStateTitle, EmptyStateDescription, EmptyStateContent };

export type {
  EmptyStateRootProps,
  EmptyStateRootProps as EmptyStateProps,
  EmptyStatePartProps,
  EmptyStateMediaProps,
  EmptyStateTitleProps,
  EmptyStateDescriptionProps,
} from "./empty-state.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { emptyStateVariants } from "../../../styles/src/components/empty-state/index.ts";

export type { EmptyStateVariants } from "../../../styles/src/components/empty-state/index.ts";
