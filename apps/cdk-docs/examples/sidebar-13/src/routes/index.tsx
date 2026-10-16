// Port of the shadcn/ui block sidebar-13 (registry/bases/aria/blocks/sidebar-13), shadcn/ui 4.21.4, MIT, © 2023 shadcn.
// Rivet: the aria base Dialog = cdk DialogTrigger + Modal + Dialog on the div overlay layer (+ its close button:
// `showCloseButton` default true, a `slot="close"` ghost icon Button after the content).
import { signal } from "@rivetjs/reactivity";
import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Link } from "@rivetjs/cdk/link";
import { Modal } from "@rivetjs/cdk/modal";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@rivetjs/cdk/sidebar";
import { Bell, Check, Globe, House, Keyboard, Link as LinkIcon, Lock, Menu, MessageCircle, Paintbrush, Settings, Video, X } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Sidebar: in a dialog" };

const nav = [
  { name: "Notifications", icon: Bell },
  { name: "Navigation", icon: Menu },
  { name: "Home", icon: House },
  { name: "Appearance", icon: Paintbrush },
  { name: "Messages & media", icon: MessageCircle },
  { name: "Language & region", icon: Globe },
  { name: "Accessibility", icon: Keyboard },
  { name: "Mark as read", icon: Check },
  { name: "Audio & video", icon: Video },
  { name: "Connected accounts", icon: LinkIcon },
  { name: "Privacy & visibility", icon: Lock },
  { name: "Advanced", icon: Settings },
];

// #region demo
export default function SettingsDialog() {
  // Open on load, as upstream (useState(true)); the server renders the open Modal.
  const open = signal(true);
  const page = signal("Messages & media");
  return (
    <div class="flex h-svh items-center justify-center">
      <DialogTrigger isOpen={open}>
        <Button id="s13-open" class="rounded-md border border-slate-300 px-3 py-1 text-sm">
          Open Dialog
        </Button>
        <Modal class="rv-Modal overflow-hidden rounded-xl bg-white p-0 shadow-xl md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
          <Dialog id="s13-dialog" class="outline-none" aria-describedby="s13-description">
            {() => (
              <>
                <Heading slot="title" class="sr-only">
                  Settings
                </Heading>
                <p id="s13-description" class="sr-only">
                  Customize your settings here.
                </p>
                {/* A provider of its own: the dialog's sidebar never collapses (collapsible="none"). */}
                <SidebarProvider class="rv-SidebarProvider min-h-0 items-start">
                  <Sidebar collapsible="none" class="rv-Sidebar hidden md:flex">
                    <SidebarContent>
                      <SidebarGroup>
                        <SidebarGroupContent>
                          <SidebarMenu>
                            {nav.map((item) => (
                              <SidebarMenuItem>
                                <SidebarMenuButton href="#" isActive={() => page() === item.name} onPress={() => page.set(item.name)}>
                                  <Icon icon={item.icon} />
                                  <span>{item.name}</span>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </SidebarGroupContent>
                      </SidebarGroup>
                    </SidebarContent>
                  </Sidebar>
                  <main class="flex h-[480px] flex-1 flex-col overflow-hidden">
                    <header class="flex h-16 shrink-0 items-center gap-2 px-4">
                      <Breadcrumbs class="flex gap-2 text-sm">
                        <Breadcrumb class="hidden md:inline-flex">
                          <Link href="#">Settings</Link>
                        </Breadcrumb>
                        <Breadcrumb>
                          <Link id="s13-page">{page()}</Link>
                        </Breadcrumb>
                      </Breadcrumbs>
                    </header>
                    <div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
                      {Array.from({ length: 10 }).map(() => (
                        <div class="aspect-video max-w-3xl rounded-xl bg-slate-100" />
                      ))}
                    </div>
                  </main>
                </SidebarProvider>
                <Button slot="close" id="s13-close" class="absolute end-4 top-4 rounded-md p-1 hover:bg-slate-100">
                  <Icon icon={X} />
                  <span class="sr-only">Close</span>
                </Button>
              </>
            )}
          </Dialog>
        </Modal>
      </DialogTrigger>
    </div>
  );
}
// #endregion
