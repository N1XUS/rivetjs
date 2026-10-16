// Port of the shadcn/ui block sidebar-07 (registry/bases/aria/blocks/sidebar-07), shadcn/ui 4.21.4, MIT, © 2023 shadcn.
// Rivet: Collapsible → cdk Disclosure; DropdownMenu → cdk MenuTrigger + Popover + Menu; Avatar → initials.
import { signal } from "@rivetjs/reactivity";
import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Disclosure, DisclosurePanel } from "@rivetjs/cdk/disclosure";
import { Link } from "@rivetjs/cdk/link";
import { Header } from "@rivetjs/cdk/header";
import { Keyboard } from "@rivetjs/cdk/keyboard";
import { Menu, MenuItem, MenuSection, MenuTrigger } from "@rivetjs/cdk/menu";
import { Popover } from "@rivetjs/cdk/popover";
import { Separator } from "@rivetjs/cdk/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
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
  SidebarRail,
  SidebarTrigger,
} from "@rivetjs/cdk/sidebar";
import {
  AudioLines,
  BookOpen,
  Bot,
  ChevronRight,
  ChevronsUpDown,
  Ellipsis,
  Frame,
  GalleryVerticalEnd,
  LogOut,
  Map as MapIcon,
  PanelLeft,
  PieChart,
  Plus,
  Settings2,
  SquareTerminal,
  Terminal,
} from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Sidebar: collapses to icons" };

const teams = [
  { name: "Acme Inc", logo: GalleryVerticalEnd, plan: "Enterprise" },
  { name: "Acme Corp.", logo: AudioLines, plan: "Startup" },
  { name: "Evil Corp.", logo: Terminal, plan: "Free" },
];
const navMain = [
  { title: "Playground", icon: SquareTerminal, isActive: true, items: ["History", "Starred", "Settings"] },
  { title: "Models", icon: Bot, isActive: false, items: ["Genesis", "Explorer", "Quantum"] },
  { title: "Documentation", icon: BookOpen, isActive: false, items: ["Introduction", "Get Started", "Tutorials", "Changelog"] },
  { title: "Settings", icon: Settings2, isActive: false, items: ["General", "Team", "Billing", "Limits"] },
];
const projects = [
  { name: "Design Engineering", icon: Frame },
  { name: "Sales & Marketing", icon: PieChart },
  { name: "Travel", icon: MapIcon },
];

// #region demo
export default function SidebarIcons() {
  const team = signal(0);
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          {/* Team switcher. */}
          <SidebarMenu>
            <SidebarMenuItem>
              <MenuTrigger>
                <SidebarMenuButton id="s07-team" size="lg">
                  <span class="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <Icon icon={teams[team()].logo} />
                  </span>
                  <span class="grid flex-1 text-start text-sm leading-tight">
                    <span id="s07-team-name" class="truncate font-medium">
                      {teams[team()].name}
                    </span>
                    <span class="truncate text-xs">{teams[team()].plan}</span>
                  </span>
                  <Icon icon={ChevronsUpDown} class="ms-auto" />
                </SidebarMenuButton>
                <Popover placement="right top" offset={4} class="rv-Popover w-(--trigger-width) min-w-56">
                  <Menu id="s07-teams" aria-label="Teams" onAction={(key) => key !== "add" && team.set(Number(key))}>
                    <MenuSection>
                      <Header class="px-2 py-1.5 text-xs text-slate-500">Teams</Header>
                      {teams.map((t, index) => (
                        <MenuItem id={String(index)} textValue={t.name} class="flex items-center gap-2 rounded p-2">
                          <span class="flex size-6 items-center justify-center rounded-md border border-slate-200">
                            <Icon icon={t.logo} />
                          </span>
                          {t.name}
                          <Keyboard class="ms-auto text-xs tracking-widest text-slate-500">⌘{index + 1}</Keyboard>
                        </MenuItem>
                      ))}
                    </MenuSection>
                    <Separator class="-mx-1 my-1 h-px bg-slate-200" />
                    <MenuItem id="add" textValue="Add team" class="flex items-center gap-2 rounded p-2">
                      <span class="flex size-6 items-center justify-center rounded-md border border-slate-200">
                        <Icon icon={Plus} />
                      </span>
                      Add team
                    </MenuItem>
                  </Menu>
                </Popover>
              </MenuTrigger>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {/* Platform: collapsible items (Disclosure), tooltips while collapsed to icons. */}
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
              {navMain.map((item) => (
                <SidebarMenuItem>
                  <Disclosure defaultExpanded={item.isActive} class="group/collapsible">
                    <SidebarMenuButton slot="trigger" tooltip={item.title}>
                      <Icon icon={item.icon} />
                      <span>{item.title}</span>
                      <Icon icon={ChevronRight} class="ms-auto transition-transform duration-200 group-data-[expanded=true]/collapsible:rotate-90" />
                    </SidebarMenuButton>
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
                  </Disclosure>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          {/* Projects: a hover-only action menu per item; hidden while collapsed to icons. */}
          <SidebarGroup class="rv-SidebarGroup group-data-[collapsible=icon]:hidden">
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
                    <Popover placement="right top" class="rv-Popover min-w-40">
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
        </SidebarContent>
        <SidebarFooter>
          {/* User menu. */}
          <SidebarMenu>
            <SidebarMenuItem>
              <MenuTrigger>
                <SidebarMenuButton id="s07-user" size="lg">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs font-medium">CN</span>
                  <span class="grid flex-1 text-start text-sm leading-tight">
                    <span class="truncate font-medium">shadcn</span>
                    <span class="truncate text-xs">m@example.com</span>
                  </span>
                  <Icon icon={ChevronsUpDown} class="ms-auto" />
                </SidebarMenuButton>
                <Popover placement="right bottom" offset={4} class="rv-Popover w-(--trigger-width) min-w-56">
                  <Menu id="s07-user-menu" aria-label="Account">
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
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header class="flex h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger id="s07-trigger">
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
