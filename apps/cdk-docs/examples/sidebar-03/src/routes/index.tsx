// Port of the shadcn/ui block sidebar-03 (registry/bases/aria/blocks/sidebar-03), shadcn/ui 4.21.4, MIT, © 2023 shadcn.
import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Link } from "@rivetjs/cdk/link";
import { Separator } from "@rivetjs/cdk/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@rivetjs/cdk/sidebar";
import { GalleryVerticalEnd, PanelLeft } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Sidebar: submenus" };

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
  { title: "Community", items: [{ title: "Contribution Guide" }] },
];

// #region demo
export default function SidebarSubmenus() {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="#" size="lg">
                <span class="flex aspect-square size-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Icon icon={GalleryVerticalEnd} />
                </span>
                <span class="flex flex-col gap-0.5 leading-none">
                  <span class="font-medium">Documentation</span>
                  <span>v1.0.0</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {navMain.map((item) => (
                <SidebarMenuItem>
                  <SidebarMenuButton href="#" class="rv-SidebarMenuButton font-medium">
                    {item.title}
                  </SidebarMenuButton>
                  {/* Sub items: an indented list under the parent item. */}
                  <SidebarMenuSub>
                    {item.items.map((sub) => (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton href="#" isActive={"isActive" in sub}>
                          {sub.title}
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header class="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 px-3">
          <SidebarTrigger id="s03-trigger">
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
