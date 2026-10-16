import { signal } from "@rivetjs/reactivity";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuActions,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuIndicator,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenuTrigger,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@rivetjs/cdk/sidebar";
import { ChartBar, ChevronRight, Folder, House, PanelLeft, Pencil, Trash2 } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Sidebar: tree" };

// #region demo
export default function SidebarTree() {
  // Stand-in for a router's location: `navigate` routes every menu link of the provider.
  const path = signal("/");
  return (
    <SidebarProvider navigate={(href) => path.set(String(href))}>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu showGuideLines="hover">
                <SidebarMenuItem>
                  <SidebarMenuButton href="/" isCurrent={() => path() === "/"}>
                    <Icon icon={House} />
                    <span>Overview</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>4</SidebarMenuBadge>
                </SidebarMenuItem>
                <SidebarMenuItem defaultExpanded>
                  <SidebarMenuTrigger id="st-projects">
                    <Icon icon={Folder} />
                    <span>Projects</span>
                    <SidebarMenuIndicator class="ml-auto">
                      <Icon icon={ChevronRight} />
                    </SidebarMenuIndicator>
                  </SidebarMenuTrigger>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton href="/projects/atlas" isCurrent={() => path() === "/projects/atlas"}>
                        Atlas
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton href="/projects/beacon" isCurrent={() => path() === "/projects/beacon"}>
                        Beacon
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
                <SidebarMenuItem expandable>
                  <SidebarMenuTrigger id="st-reports">
                    <Icon icon={ChartBar} />
                    <span>Reports</span>
                    <SidebarMenuIndicator class="ml-auto">
                      <Icon icon={ChevronRight} />
                    </SidebarMenuIndicator>
                  </SidebarMenuTrigger>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton id="st-q3" href="/reports/q3" isCurrent={() => path() === "/reports/q3"}>
                        Q3 review
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton href="/reports/q4" isCurrent={() => path() === "/reports/q4"}>
                        Q4 plan
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                  <SidebarMenuActions showOnHover aria-label="Report actions">
                    <SidebarMenuAction aria-label="Rename reports">
                      <Icon icon={Pencil} size={14} />
                    </SidebarMenuAction>
                    <SidebarMenuAction aria-label="Delete reports">
                      <Icon icon={Trash2} size={14} />
                    </SidebarMenuAction>
                  </SidebarMenuActions>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header class="flex h-12 items-center gap-2 border-b border-slate-200 px-4 text-sm">
          <SidebarTrigger class="rounded p-1 hover:bg-slate-100">
            <Icon icon={PanelLeft} />
          </SidebarTrigger>
          <span>
            Path: <code id="st-path">{path()}</code>
          </span>
        </header>
      </SidebarInset>
    </SidebarProvider>
  );
}
// #endregion
