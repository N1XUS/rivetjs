// Port of the shadcn/ui block sidebar-01 (registry/bases/aria/blocks/sidebar-01), shadcn/ui 4.21.4, MIT, © 2023 shadcn.
import { signal } from "@rivetjs/reactivity";
import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Link } from "@rivetjs/cdk/link";
import { Menu, MenuItem, MenuTrigger, type Selection } from "@rivetjs/cdk/menu";
import { Popover } from "@rivetjs/cdk/popover";
import { Separator } from "@rivetjs/cdk/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@rivetjs/cdk/sidebar";
import { Check, ChevronsUpDown, GalleryVerticalEnd, PanelLeft, Search } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Sidebar: grouped navigation" };

const versions = ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"];
const navMain = [
  { title: "Getting Started", items: [{ title: "Installation" }, { title: "Project Structure" }] },
  {
    title: "Build Your Application",
    items: [
      { title: "Routing" },
      { title: "Data Fetching", isActive: true },
      { title: "Rendering" },
      { title: "Caching" },
      { title: "Styling" },
      { title: "Optimizing" },
      { title: "Configuring" },
      { title: "Testing" },
      { title: "Authentication" },
      { title: "Deploying" },
      { title: "Upgrading" },
      { title: "Examples" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { title: "Components" },
      { title: "File Conventions" },
      { title: "Functions" },
      { title: "next.config.js Options" },
      { title: "CLI" },
      { title: "Edge Runtime" },
    ],
  },
  {
    title: "Architecture",
    items: [{ title: "Accessibility" }, { title: "Fast Refresh" }, { title: "Next.js Compiler" }, { title: "Supported Browsers" }, { title: "Turbopack" }],
  },
];

// #region demo
export default function SidebarGrouped() {
  const version = signal<Selection>(new Set([versions[0]]));
  return (
    <SidebarProvider>
      <Sidebar id="s01">
        <SidebarHeader>
          {/* Version switcher: a menu opened from a large menu button. */}
          <SidebarMenu>
            <SidebarMenuItem>
              <MenuTrigger>
                <SidebarMenuButton id="s01-version" size="lg">
                  <span class="flex aspect-square size-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <Icon icon={GalleryVerticalEnd} />
                  </span>
                  <span class="flex flex-col gap-0.5 leading-none">
                    <span class="font-medium">Documentation</span>
                    <span id="s01-version-value">v{[...(version() as Set<string>)][0]}</span>
                  </span>
                  <Icon icon={ChevronsUpDown} class="ms-auto" />
                </SidebarMenuButton>
                <Popover placement="bottom start" class="rv-Popover w-(--trigger-width)">
                  <Menu id="s01-versions" selectionMode="single" disallowEmptySelection selectedKeys={version}>
                    {versions.map((v) => (
                      <MenuItem id={v} textValue={v} class="flex items-center gap-2 rounded px-2 py-1">
                        {({ isSelected }) => (
                          <>
                            v{v}
                            {isSelected() ? <Icon icon={Check} class="ms-auto" /> : null}
                          </>
                        )}
                      </MenuItem>
                    ))}
                  </Menu>
                </Popover>
              </MenuTrigger>
            </SidebarMenuItem>
          </SidebarMenu>
          {/* Search form. */}
          <form onSubmit={(event) => event.preventDefault()}>
            <SidebarGroup class="rv-SidebarGroup py-0">
              <SidebarGroupContent class="rv-SidebarGroupContent relative">
                <label for="s01-search" class="sr-only">
                  Search
                </label>
                <SidebarInput id="s01-search" placeholder="Search the docs..." class="rv-SidebarInput ps-8" />
                <Icon icon={Search} class="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 opacity-50" />
              </SidebarGroupContent>
            </SidebarGroup>
          </form>
        </SidebarHeader>
        <SidebarContent>
          {navMain.map((group) => (
            <SidebarGroup>
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem>
                      <SidebarMenuButton href="#" isActive={"isActive" in item}>
                        {item.title}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarRail id="s01-rail" />
      </Sidebar>
      <SidebarInset>
        <header class="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 px-4">
          <SidebarTrigger id="s01-trigger" class="rv-SidebarTrigger -ms-1">
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
        <div class="flex flex-1 flex-col gap-4 p-4">
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
