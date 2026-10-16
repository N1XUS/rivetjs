// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no app layout). Compound API `AppLayout.*`; feature set inspired by
// HeroUI Pro's public AppLayout docs, independent implementation. Sidebar = `@rivetjs/ui/sidebar` (shadcn/ui behaviour).
import { AppLayoutAsideTrigger, AppLayoutMenuToggle, AppLayoutMobileAside, AppLayoutRoot, useAppLayout } from "./app-layout.tsx";
import type { AppLayoutAsideTriggerProps, AppLayoutMenuToggleProps, AppLayoutMobileAsideProps, AppLayoutRootProps } from "./app-layout.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const AppLayout = Object.assign(AppLayoutRoot, {
  Root: AppLayoutRoot,
  MenuToggle: AppLayoutMenuToggle,
  AsideTrigger: AppLayoutAsideTrigger,
  MobileAside: AppLayoutMobileAside,
});

export type AppLayout = {
  Props: AppLayoutRootProps;
  RootProps: AppLayoutRootProps;
  MenuToggleProps: AppLayoutMenuToggleProps;
  AsideTriggerProps: AppLayoutAsideTriggerProps;
  MobileAsideProps: AppLayoutMobileAsideProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { AppLayoutRoot, AppLayoutMenuToggle, AppLayoutAsideTrigger, AppLayoutMobileAside, useAppLayout };

export type {
  AppLayoutRootProps,
  AppLayoutRootProps as AppLayoutProps,
  AppLayoutMenuToggleProps,
  AppLayoutAsideTriggerProps,
  AppLayoutMobileAsideProps,
  AppLayoutTooltipProps,
  AppLayoutApi,
} from "./app-layout.tsx";

export { ASIDE_BREAKPOINT, ASIDE_COOKIE_NAME, asideCookieOpen } from "./app-layout-state.ts";
export type { AppLayoutSize } from "./app-layout-state.ts";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { appLayoutVariants } from "../../../styles/src/components/app-layout/index.ts";

export type { AppLayoutVariants } from "../../../styles/src/components/app-layout/index.ts";
