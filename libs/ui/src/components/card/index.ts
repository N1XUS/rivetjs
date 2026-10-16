// Ported from HeroUI v3.2.6 packages/react/src/components/card/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof CardX>` → the default-element prop types (`CardRootDivProps`, …; `Parameters<…>[0]`
// of a generic part resolves `E` to its whole constraint); `@heroui/styles` → vendored `styles/`.
import type { CardContentDivProps, CardDescriptionPProps, CardFooterDivProps, CardHeaderDivProps, CardRootDivProps, CardTitleH3Props } from "./card.tsx";
import { CardContent, CardDescription, CardFooter, CardHeader, CardRoot, CardTitle } from "./card.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Card = Object.assign(CardRoot, {
  Root: CardRoot,
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Content: CardContent,
  Footer: CardFooter,
});

export type Card = {
  Props: CardRootDivProps;
  RootProps: CardRootDivProps;
  HeaderProps: CardHeaderDivProps;
  TitleProps: CardTitleH3Props;
  DescriptionProps: CardDescriptionPProps;
  ContentProps: CardContentDivProps;
  FooterProps: CardFooterDivProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { CardRoot, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };

export type {
  CardRootProps,
  CardRootProps as CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardContentProps,
  CardFooterProps,
} from "./card.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { cardVariants } from "../../../styles/src/components/card/index.ts";

export type { CardVariants } from "../../../styles/src/components/card/index.ts";
