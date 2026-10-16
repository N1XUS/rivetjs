// Ported from HeroUI v3.2.6 packages/react/src/components/typography/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the props interfaces (the parts are not generic); `@heroui/styles` → vendored `styles/`.
import { Code, Heading, Paragraph, Prose, TypographyRoot } from "./typography.tsx";
import type { CodeProps, HeadingProps, ParagraphProps, ProseProps, TypographyRootProps } from "./typography.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Typography = Object.assign(TypographyRoot, {
  Code,
  Heading,
  Paragraph,
  Prose,
  Root: TypographyRoot,
});

export type Typography = {
  CodeProps: CodeProps;
  HeadingProps: HeadingProps;
  ParagraphProps: ParagraphProps;
  ProseProps: ProseProps;
  Props: TypographyRootProps;
  RootProps: TypographyRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { Code, Heading, Paragraph, Prose, TypographyRoot };

export type { CodeProps, HeadingProps, ParagraphProps, ProseProps, TypographyRootProps, TypographyRootProps as TypographyProps } from "./typography.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { typographyVariants } from "../../../styles/src/components/typography/index.ts";

export type { TypographyVariants } from "../../../styles/src/components/typography/index.ts";
