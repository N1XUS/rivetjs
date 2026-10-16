// Rivet addition (no HeroUI v3.2.6 counterpart): floating selection toolbar; feature set inspired by HeroUI Pro's public docs,
// independent implementation (see `action-bar.tsx`).
import { ActionBarContent, ActionBarPrefix, ActionBarRoot, ActionBarSuffix } from "./action-bar.tsx";
import type { ActionBarContentProps, ActionBarPrefixProps, ActionBarRootProps, ActionBarSuffixProps } from "./action-bar.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ActionBar = Object.assign(ActionBarRoot, {
  Root: ActionBarRoot,
  Prefix: ActionBarPrefix,
  Content: ActionBarContent,
  Suffix: ActionBarSuffix,
});

export type ActionBar = {
  Props: ActionBarRootProps;
  RootProps: ActionBarRootProps;
  PrefixProps: ActionBarPrefixProps;
  ContentProps: ActionBarContentProps;
  SuffixProps: ActionBarSuffixProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ActionBarRoot, ActionBarPrefix, ActionBarContent, ActionBarSuffix, ActionBarContext } from "./action-bar.tsx";
export type {
  ActionBarRootProps,
  ActionBarRootProps as ActionBarProps,
  ActionBarPrefixProps,
  ActionBarContentProps,
  ActionBarSuffixProps,
  ActionBarPartDivProps,
  ActionBarOrientation,
} from "./action-bar.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { actionBarVariants } from "../../../styles/src/components/action-bar/index.ts";

export type { ActionBarVariants } from "../../../styles/src/components/action-bar/index.ts";
