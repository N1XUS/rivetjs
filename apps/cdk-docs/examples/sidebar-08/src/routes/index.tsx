// Port of the shadcn/ui block sidebar-08 (registry/bases/aria/blocks/sidebar-08), shadcn/ui 4.21.4, MIT, © 2023 shadcn.
// Rivet: Collapsible → cdk Disclosure (SidebarMenuAction slot="trigger" toggles it); DropdownMenu → cdk MenuTrigger +
// Popover + Menu; Avatar → initials.
import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Disclosure, DisclosurePanel } from "@rivetjs/cdk/disclosure";
import { Link } from "@rivetjs/cdk/link";
import { Header } from "@rivetjs/cdk/header";
import { Menu, MenuItem, MenuSection, MenuTrigger } from "@rivetjs/cdk/menu";
import { Popover } from "@rivetjs/cdk/popover";
import { Separator } from "@rivetjs/cdk/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@rivetjs/cdk/sidebar";
import {
  BookOpen,
  Bot,
  ChevronRight,
  ChevronsUpDown,
  Ellipsis,
  Frame,
  LifeBuoy,
  LogOut,
  Map as MapIcon,
  PanelLeft,
  PieChart,
  Send,
  Settings2,
  SquareTerminal,
  Terminal,
} from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Sidebar: inset" };

const navMain = [
  { title: "Playground", icon: SquareTerminal, isActive: true, items: ["History", "Starred", "Settings"] },
  { title: "Models", icon: Bot, isActive: false, items: ["Genesis", "Explorer", "Quantum"] },
  { title: "Documentation", icon: BookOpen, isActive: false, items: ["Introduction", "Get Started", "Tutorials", "Changelog"] },
  { title: "Settings", icon: Settings2, isActive: false, items: ["General", "Team", "Billing", "Limits"] },
];
const navSecondary = [
  { title: "Support", icon: LifeBuoy },
  { title: "Feedback", icon: Send },
];
const projects = [
  { name: "Design Engineering", icon: Frame },
  { name: "Sales & Marketing", icon: PieChart },
  { name: "Travel", icon: MapIcon },
];

// #region demo
export default function SidebarInsetDemo() {
  return (
    <SidebarProvider>
      {/* variant="inset": the page content sits in a raised panel next to the sidebar. */}
      <Sidebar variant="inset" id="s08">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="#" size="lg">
                <span class="flex aspect-square size-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Icon icon={Terminal} />
                </span>
                <span class="grid flex-1 text-start text-sm leading-tight">
                  <span class="truncate font-medium">Acme Inc</span>
                  <span class="truncate text-xs">Enterprise</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
              {navMain.map((item) => (
                // Upstream Collapsible render={<SidebarMenuItem />}: the disclosure IS the menu item (li).
                <Disclosure
                  defaultExpanded={item.isActive}
                  class="rv-SidebarMenuItem group/collapsible"
                  render={(props) => <li {...(props as {})} data-slot="sidebar-menu-item" data-sidebar="menu-item" />}
                >
                  <>
                    <SidebarMenuButton href="#" tooltip={item.title}>
                      <Icon icon={item.icon} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {/* A separate action toggles the sub menu, the button stays a link. */}
                    <SidebarMenuAction slot="trigger" class="rv-SidebarMenuAction group-data-[expanded=true]/collapsible:rotate-90">
                      <Icon icon={ChevronRight} />
                      <span class="sr-only">Toggle</span>
                    </SidebarMenuAction>
                    <DisclosurePanel>
                      <SidebarMenuSub>
                        {item.items.map((sub) => (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton href="#">
                              <span>{sub}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </DisclosurePanel>
                  </>
                </Disclosure>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <SidebarMenu>
              {projects.map((project) => (
                <SidebarMenuItem>
                  <SidebarMenuButton href="#">
                    <Icon icon={project.icon} />
                    <span>{project.name}</span>
                  </SidebarMenuButton>
                  <MenuTrigger>
                    <SidebarMenuAction showOnHover aria-label={`More: ${project.name}`}>
                      <Icon icon={Ellipsis} />
                    </SidebarMenuAction>
                    <Popover placement="right top" class="rv-Popover w-48">
                      <Menu aria-label="Project">
                        <MenuItem id="view" class="rounded px-2 py-1">
                          View Project
                        </MenuItem>
                        <MenuItem id="share" class="rounded px-2 py-1">
                          Share Project
                        </MenuItem>
                        <MenuItem id="delete" class="rounded px-2 py-1 text-red-600">
                          Delete Project
                        </MenuItem>
                      </Menu>
                    </Popover>
                  </MenuTrigger>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton class="text-slate-500">
                  <Icon icon={Ellipsis} />
                  <span>More</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          {/* Secondary navigation pushed to the bottom (mt-auto), small buttons. */}
          <SidebarGroup class="rv-SidebarGroup mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                {navSecondary.map((item) => (
                  <SidebarMenuItem>
                    <SidebarMenuButton href="#" size="sm">
                      <Icon icon={item.icon} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <MenuTrigger>
                <SidebarMenuButton id="s08-user" size="lg">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs font-medium">CN</span>
                  <span class="grid flex-1 text-start text-sm leading-tight">
                    <span class="truncate font-medium">shadcn</span>
                    <span class="truncate text-xs">m@example.com</span>
                  </span>
                  <Icon icon={ChevronsUpDown} class="ms-auto" />
                </SidebarMenuButton>
                <Popover placement="right bottom" offset={4} class="rv-Popover w-(--trigger-width) min-w-56">
                  <Menu id="s08-user-menu" aria-label="Account">
                    <MenuSection>
                      <Header class="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                        <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs font-medium">CN</span>
                        <span class="grid flex-1 text-start text-sm leading-tight">
                          <span class="truncate font-medium">shadcn</span>
                          <span class="truncate text-xs">m@example.com</span>
                        </span>
                      </Header>
                      <Separator class="-mx-1 my-1 h-px bg-slate-200" />
                      <MenuItem id="upgrade" class="rounded px-2 py-1">
                        Upgrade to Pro
                      </MenuItem>
                    </MenuSection>
                    <Separator class="-mx-1 my-1 h-px bg-slate-200" />
                    <MenuItem id="account" class="rounded px-2 py-1">
                      Account
                    </MenuItem>
                    <MenuItem id="billing" class="rounded px-2 py-1">
                      Billing
                    </MenuItem>
                    <MenuItem id="notifications" class="rounded px-2 py-1">
                      Notifications
                    </MenuItem>
                    <Separator class="-mx-1 my-1 h-px bg-slate-200" />
                    <MenuItem id="logout" textValue="Log out" class="flex items-center gap-2 rounded px-2 py-1">
                      <Icon icon={LogOut} />
                      Log out
                    </MenuItem>
                  </Menu>
                </Popover>
              </MenuTrigger>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset id="s08-inset">
        <header class="flex h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger id="s08-trigger">
            <Icon icon={PanelLeft} />
          </SidebarTrigger>
          <Separator orientation="vertical" class="me-2 h-4 w-px bg-slate-200" />
          <Breadcrumbs class="flex gap-2 text-sm">
            <Breadcrumb class="hidden md:inline-flex">
              <Link href="#">Build Your Application</Link>
            </Breadcrumb>
            <Breadcrumb>
              <Link>Data Fetching</Link>
            </Breadcrumb>
          </Breadcrumbs>
        </header>
        <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div class="grid auto-rows-min gap-4 md:grid-cols-3">
            <div class="aspect-video rounded-xl bg-slate-100" />
            <div class="aspect-video rounded-xl bg-slate-100" />
            <div class="aspect-video rounded-xl bg-slate-100" />
          </div>
          <div class="min-h-64 flex-1 rounded-xl bg-slate-100" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
// #endregion
