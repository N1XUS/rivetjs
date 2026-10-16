import { signal } from "@rivetjs/reactivity";
import type { PageProps } from "@rivetjs/router";
import { Button } from "@rivetjs/cdk/button";
import { Disclosure, DisclosurePanel } from "@rivetjs/cdk/disclosure";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";
import { Popover } from "@rivetjs/cdk/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@rivetjs/cdk/sidebar";

export const head = { title: "Sidebar" };

// Sidebar (shadcn/ui port) on a resumed page: cookie-backed `defaultOpen` (sidebar.server.ts), trigger, rail,
// Cmd/Ctrl+B, collapsed-only tooltips (collapsible="icon"), a Disclosure group, a footer menu (MenuTrigger on a
// size="lg" button: collapsed size, Tab containment in the mobile sheet).
export default function SidebarStory({ data }: PageProps<{ open: boolean | null }, {}>) {
  const log = signal("");
  const pressed = signal(0);
  return (
    <SidebarProvider id="wrapper" defaultOpen={data.open ?? true} onOpenChange={(open) => log.set(log() + (open ? "o" : "c"))}>
      <Sidebar collapsible="icon" id="panel">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Application</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton id="home" href="#home" isActive tooltip="Home">
                    <span>Home</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton id="inbox" tooltip="Inbox" onPress={() => pressed.set(pressed() + 1)}>
                    <span>Inbox</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <Disclosure defaultExpanded>
            <SidebarGroup>
              <SidebarGroupLabel id="help" render={(p) => <Button slot="trigger" {...(p as {})} />}>
                Help
              </SidebarGroupLabel>
              <DisclosurePanel>
                <SidebarGroupContent id="help-content">Docs</SidebarGroupContent>
              </DisclosurePanel>
            </SidebarGroup>
          </Disclosure>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <MenuTrigger>
                <SidebarMenuButton id="user" size="lg">
                  <span>User</span>
                </SidebarMenuButton>
                <Popover placement="right bottom" class="rv-Popover">
                  <Menu id="user-menu" aria-label="Account">
                    <MenuItem id="logout">Log out</MenuItem>
                  </Menu>
                </Popover>
              </MenuTrigger>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail id="rail" />
      </Sidebar>
      <SidebarInset>
        <h1>Sidebar</h1>
        <SidebarTrigger id="trigger" />
        <output id="log">{log()}</output>
        <output id="pressed">{pressed()}</output>
      </SidebarInset>
    </SidebarProvider>
  );
}
