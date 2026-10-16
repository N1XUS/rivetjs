import { signal } from "@rivetjs/reactivity";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuIndicator,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenuTrigger,
  SidebarPage,
  SidebarPages,
  SidebarProvider,
  SidebarTrigger,
  useSidebarPages,
} from "@rivetjs/cdk/sidebar";

export const head = { title: "Sidebar extensions" };

function PageButton(props: { id: string; to: string; label: string }) {
  const pages = useSidebarPages();
  const to = props.to;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton id={props.id} onPress={() => pages.setActiveValue(to)}>
        {props.label}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// Rivet Sidebar extensions on a resumed page: tree items (expandable + MenuTrigger), a client router through
// `navigate` with `isCurrent` accessors, `forceReload`, pages, a custom `toggleShortcut`, `closeMobileOnAction`.
export default function SidebarExtensionsStory() {
  const path = signal("/");
  const page = signal("main");
  const expanded = signal("");
  return (
    <SidebarProvider id="wrapper" toggleShortcut="alt+s" closeMobileOnAction navigate={(href) => path.set(String(href))}>
      <Sidebar id="panel">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu showGuideLines="hover">
                <SidebarMenuItem>
                  <SidebarMenuButton id="x-home" href="/home" isCurrent={() => path() === "/home"}>
                    Home
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem defaultExpanded onExpandedChange={(open) => expanded.set(expanded() + (open ? "o" : "c"))}>
                  <SidebarMenuTrigger id="x-projects">
                    Projects
                    <SidebarMenuIndicator id="x-indicator" />
                  </SidebarMenuTrigger>
                  <SidebarMenuSub id="x-sub">
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton id="x-atlas" href="/atlas" isCurrent={() => path() === "/atlas"}>
                        Atlas
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton id="x-legacy" href="/legacy" forceReload>
                    Legacy
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup closeMobileOnAction={false}>
            <SidebarPages value={page}>
              <SidebarPage value="main" aria-label="Main">
                <SidebarMenu>
                  <PageButton id="x-to-settings" to="settings" label="Settings" />
                </SidebarMenu>
              </SidebarPage>
              <SidebarPage value="settings" aria-label="Settings">
                <SidebarMenu>
                  <PageButton id="x-back" to="main" label="Back" />
                </SidebarMenu>
              </SidebarPage>
            </SidebarPages>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger id="x-trigger">Toggle</SidebarTrigger>
        <p id="x-path">{path()}</p>
        <p id="x-page">{page()}</p>
        <p id="x-expanded">{expanded()}</p>
      </SidebarInset>
    </SidebarProvider>
  );
}
