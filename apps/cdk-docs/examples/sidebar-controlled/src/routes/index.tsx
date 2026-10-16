import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@rivetjs/cdk/sidebar";
import { Inbox, PanelLeft, Send } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Sidebar: controlled" };

// useSidebar() inside the provider: accessors + setters.
function Status() {
  const sidebar = useSidebar();
  return (
    <p id="sc-status" class="text-sm">
      state={sidebar.state()} mobile={String(sidebar.isMobile())}
    </p>
  );
}

// #region demo
export default function SidebarControlled() {
  // A two-way Signal: the trigger, the rail and Ctrl+B write it; your code reads and sets it.
  const open = signal(true);
  const side = signal<"left" | "right">("left");
  const variant = signal<"sidebar" | "floating" | "inset">("sidebar");
  const log = signal<string[]>([]);
  return (
    <SidebarProvider open={open} onOpenChange={(value) => log.update((l) => [...l, value ? "open" : "close"])}>
      <Sidebar side={() => side()} variant={() => variant()}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Mail</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton href="#" isActive>
                    <Icon icon={Inbox} />
                    <span>Inbox</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>24</SidebarMenuBadge>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton href="#" variant="outline">
                    <Icon icon={Send} />
                    <span>Sent</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {/* Loading placeholders. */}
                <SidebarMenuItem>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset class="rv-SidebarInset gap-3 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <SidebarTrigger id="sc-trigger">
            <Icon icon={PanelLeft} />
          </SidebarTrigger>
          <Button id="sc-close" class="rounded-md border border-slate-300 px-3 py-1 text-sm" onPress={() => open.set(false)}>
            Close from outside
          </Button>
          <Button id="sc-side" class="rounded-md border border-slate-300 px-3 py-1 text-sm" onPress={() => side.set(side() === "left" ? "right" : "left")}>
            Side: {side()}
          </Button>
          <Button
            id="sc-variant"
            class="rounded-md border border-slate-300 px-3 py-1 text-sm"
            onPress={() => variant.set(variant() === "sidebar" ? "floating" : variant() === "floating" ? "inset" : "sidebar")}
          >
            Variant: {variant()}
          </Button>
        </div>
        <Status />
        <p id="sc-open" class="text-sm">
          open={String(open())}
        </p>
        <p id="sc-log" class="text-sm">
          {log().join(" ")}
        </p>
      </SidebarInset>
    </SidebarProvider>
  );
}
// #endregion
