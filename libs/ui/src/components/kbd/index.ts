// Ported from HeroUI v3.2.6 packages/react/src/components/kbd/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof KbdX>` → the default-element prop types (`KbdRootKbdProps`, …); `@heroui/styles` → vendored `styles/`.
import type { KbdAbbrAbbrProps, KbdContentSpanProps, KbdRootKbdProps } from "./kbd.tsx";
import { KbdAbbr, KbdContent, KbdRoot } from "./kbd.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Kbd = Object.assign(KbdRoot, {
  Root: KbdRoot,
  Abbr: KbdAbbr,
  Content: KbdContent,
});

export type Kbd = {
  Props: KbdRootKbdProps;
  RootProps: KbdRootKbdProps;
  AbbrProps: KbdAbbrAbbrProps;
  ContentProps: KbdContentSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { KbdRoot, KbdAbbr, KbdContent };

export type { KbdRootProps, KbdAbbrProps, KbdContentProps, KbdRootProps as KbdProps } from "./kbd.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { kbdVariants } from "../../../styles/src/components/kbd/index.ts";

export type { KbdVariants } from "../../../styles/src/components/kbd/index.ts";

/* -------------------------------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------------------------*/
export { kbdKeysMap, kbdKeysLabelMap } from "./kbd.constants.ts";

export type { KbdKey } from "./kbd.constants.ts";
