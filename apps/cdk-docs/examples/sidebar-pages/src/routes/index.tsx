import { signal } from "@rivetjs/reactivity";
import type { IconNode } from "lucide";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarPage,
  SidebarPages,
  SidebarProvider,
  SidebarTrigger,
  useSidebarPages,
} from "@rivetjs/cdk/sidebar";
import { ArrowLeft, Bell, ChevronRight, House, Inbox, Palette, PanelLeft, Settings } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Sidebar: pages and shortcut" };

// A menu button that switches page through the pages context.
function PageLink(props: { id: string; to: string; label: string; icon: IconNode; back?: boolean }) {
  const pages = useSidebarPages();
  const to = props.to;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton id={props.id} onPress={() => pages.setActiveValue(to)}>
        <Icon icon={props.icon} />
        <span>{props.label}</span>
        {props.back ? null : <Icon icon={ChevronRight} class="ml-auto" />}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// #region demo
export default function SidebarPagesExample() {
  const page = signal("main");
  return (
    <SidebarProvider toggleShortcut="alt+s">
      <Sidebar backdrop="opaque">
        <SidebarContent>
          <SidebarPages value={page}>
            <SidebarPage value="main" aria-label="Main">
              <SidebarGroup>
                <SidebarGroupLabel>Main</SidebarGroupLabel>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton href="#home" isCurrent>
                      <Icon icon={House} />
                      <span>Home</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton href="#inbox">
                      <Icon icon={Inbox} />
                      <span>Inbox</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <PageLink id="sp-settings" to="settings" label="Settings" icon={Settings} />
                </SidebarMenu>
              </SidebarGroup>
            </SidebarPage>
            <SidebarPage value="settings" aria-label="Settings">
              <SidebarGroup>
                <SidebarMenu>
                  <PageLink id="sp-back" to="main" label="Back" icon={ArrowLeft} back />
                </SidebarMenu>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupLabel>Settings</SidebarGroupLabel>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton href="#appearance">
                      <Icon icon={Palette} />
                      <span>Appearance</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton href="#notifications">
                      <Icon icon={Bell} />
                      <span>Notifications</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            </SidebarPage>
          </SidebarPages>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header class="flex h-12 items-center gap-2 border-b border-slate-200 px-4 text-sm">
          <SidebarTrigger class="rounded p-1 hover:bg-slate-100">
            <Icon icon={PanelLeft} />
          </SidebarTrigger>
          <span>
            Page: <code id="sp-page">{page()}</code> · Alt+S toggles the sidebar
          </span>
        </header>
      </SidebarInset>
    </SidebarProvider>
  );
}
// #endregion
