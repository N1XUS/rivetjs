// Ported from HeroUI v3.2.6 packages/react/src/components/tabs/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types (default-element types for the generic parts); `@heroui/styles` →
// vendored `styles/`.
import { Tab, TabIndicator, TabList, TabListContainer, TabPanel, TabSeparator, TabsRoot } from "./tabs.tsx";
import type { TabIndicatorProps, TabListContainerDivProps, TabListProps, TabPanelProps, TabProps, TabSeparatorSpanProps, TabsRootProps } from "./tabs.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Tabs = Object.assign(TabsRoot, {
  Root: TabsRoot,
  ListContainer: TabListContainer,
  List: TabList,
  Tab,
  Indicator: TabIndicator,
  Separator: TabSeparator,
  Panel: TabPanel,
});

export type Tabs = {
  Props: TabsRootProps;
  RootProps: TabsRootProps;
  ListContainer: TabListContainerDivProps;
  ListProps: TabListProps;
  TabProps: TabProps;
  IndicatorProps: TabIndicatorProps;
  SeparatorProps: TabSeparatorSpanProps;
  PanelProps: TabPanelProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { TabsRoot, TabListContainer, TabList, Tab, TabIndicator, TabSeparator, TabPanel };

export type {
  TabsRootProps,
  TabsRootProps as TabsProps,
  TabListContainerProps,
  TabListProps,
  TabProps,
  TabIndicatorProps,
  TabSeparatorProps,
  TabPanelProps,
} from "./tabs.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { tabsVariants } from "../../../styles/src/components/tabs/index.ts";

export type { TabsVariants } from "../../../styles/src/components/tabs/index.ts";
