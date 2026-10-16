// Type-level checks for `@rivetjs/ui/app-layout` (tsc -p libs/ui only).
import { signal } from "@rivetjs/reactivity";
import { AppLayout, useAppLayout } from "../src/components/app-layout/index.ts";

const open = signal(true);

export const ok = () => (
  <AppLayout
    sidebar={() => <nav />}
    navbar={() => <AppLayout.MenuToggle tooltip="Menu" tooltipProps={{ placement: "bottom", delay: 0 }} />}
    aside={() => <AppLayout.MobileAside>m</AppLayout.MobileAside>}
    sidebarOpen={open}
    sidebarSide="right"
    sidebarVariant="inset"
    sidebarCollapsible="offcanvas"
    asideMobile="sheet"
    asideToggleShortcut="mod+shift+b"
    sidebarResizable
    sidebarDefaultSize="280px"
    resizableAutoSaveId="x"
    scrollMode="content"
    toggleShortcut={false}
    reduceMotion
  >
    <AppLayout.AsideTrigger closedTooltip="Show" openTooltip="Hide" />
  </AppLayout>
);

export const api = () => useAppLayout()?.isAsideOpen();

// @ts-expect-error bad scroll mode
export const badScroll = () => <AppLayout scrollMode="window" />;
// @ts-expect-error bad collapsible
export const badCollapsible = () => <AppLayout sidebarCollapsible="mini" />;
// @ts-expect-error bad asideMobile
export const badMobile = () => <AppLayout asideMobile="drawer" />;
