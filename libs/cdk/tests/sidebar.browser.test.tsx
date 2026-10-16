// Behaviour tests for `@rivetjs/cdk/sidebar` (port of shadcn/ui Sidebar 4.21.4, MIT). shadcn ships no unit
// tests for the Sidebar: the expectations are written from its source (apps/v4/registry/new-york-v4/ui/sidebar.tsx,
// bases/aria/ui/sidebar.tsx) and docs (content/docs/components/*/sidebar.mdx): toggle (trigger, rail, Cmd/Ctrl+B),
// controlled / uncontrolled state, the `sidebar_state` cookie, `data-*` attributes, CSS variables, the mobile sheet
// (viewport < 768px), collapsed-only tooltips, collapsible groups (Disclosure), keyboard reachability.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Button } from "../button/index.tsx";
import { Disclosure, DisclosurePanel } from "../disclosure/index.tsx";
import { _resetTooltips } from "../state/tooltip.ts";
import {
  SIDEBAR_COOKIE_NAME,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  sidebarCookieOpen,
  useSidebar,
  type SidebarContextValue,
  type SidebarProps,
} from "../sidebar/index.tsx";

const screen = () => within(document.body);
const wait = async (ms = 30) => {
  await flush();
  await new Promise((resolve) => setTimeout(resolve, ms));
  await flush();
};
const root = () => document.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
const clearCookie = () => (document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`);
const cookie = () => document.cookie.split("; ").find((c) => c.startsWith(SIDEBAR_COOKIE_NAME + "="));

function App(props: { sidebar?: SidebarProps; provider?: Record<string, unknown>; api?: (api: SidebarContextValue) => void }) {
  const Probe = () => {
    props.api?.(useSidebar());
    return null;
  };
  return (
    <SidebarProvider {...(props.provider ?? {})}>
      <Probe />
      <Sidebar {...(props.sidebar ?? {})}>
        <SidebarHeader>Header</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Application</SidebarGroupLabel>
            <SidebarGroupAction aria-label="Add project">+</SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton id="home" href="#home" isActive tooltip="Home">
                    <span>Home</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>24</SidebarMenuBadge>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton id="inbox" tooltip="Inbox" size="lg" variant="outline">
                    <span>Inbox</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction id="inbox-action" showOnHover aria-label="More">
                    ...
                  </SidebarMenuAction>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton id="sub" href="#sub">
                        Sub
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
        </SidebarContent>
        <SidebarFooter>Footer</SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger id="trigger" />
        <SidebarInput aria-label="Search" />
      </SidebarInset>
    </SidebarProvider>
  );
}

let user: ReturnType<typeof userEvent.setup>;
const realWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
const setWidth = (w: number) => Object.defineProperty(window, "innerWidth", { configurable: true, get: () => w });

beforeEach(() => {
  user = userEvent.setup({ delay: null });
  clearCookie();
  // The test iframe is narrower than 768px: desktop unless a test says otherwise.
  setWidth(1024);
});
afterEach(async () => {
  cleanup();
  _resetTooltips();
  if (realWidth) Object.defineProperty(window, "innerWidth", realWidth);
  clearCookie();
  await flush();
});

describe("SidebarProvider", () => {
  it("renders the wrapper with the width variables", async () => {
    render(() => <App provider={{ style: { "--sidebar-width": "20rem" }, id: "wrap" }} />);
    await wait();
    const wrapper = document.getElementById("wrap")!;
    expect(wrapper).toHaveAttribute("data-slot", "sidebar-wrapper");
    expect(wrapper).toHaveClass("rv-SidebarProvider");
    expect(wrapper.style.getPropertyValue("--sidebar-width")).toBe("20rem");
    expect(wrapper.style.getPropertyValue("--sidebar-width-icon")).toBe("3rem");
  });

  it("useSidebar throws outside a provider", () => {
    const Bad = () => {
      useSidebar();
      return null;
    };
    expect(() => render(() => <Bad />)).toThrow("useSidebar must be used within a SidebarProvider.");
  });

  it("defaults to expanded; defaultOpen={false} starts collapsed", async () => {
    render(() => <App />);
    await wait();
    expect(root()).toHaveAttribute("data-state", "expanded");
    expect(root()).toHaveAttribute("data-collapsible", "");
    cleanup();
    render(() => <App provider={{ defaultOpen: false }} />);
    await wait();
    expect(root()).toHaveAttribute("data-state", "collapsed");
    expect(root()).toHaveAttribute("data-collapsible", "offcanvas");
  });
});

describe("Sidebar", () => {
  it("renders the desktop structure and data attributes", async () => {
    render(() => <App sidebar={{ side: "right", variant: "floating", collapsible: "icon", class: "mine", id: "panel" }} />);
    await wait();
    const r = root();
    expect(r).toHaveClass("rv-Sidebar");
    expect(r).toHaveAttribute("data-variant", "floating");
    expect(r).toHaveAttribute("data-side", "right");
    expect(r.querySelector('[data-slot="sidebar-gap"]')).toHaveClass("rv-Sidebar-gap");
    const container = document.getElementById("panel")!;
    expect(container).toHaveAttribute("data-slot", "sidebar-container");
    expect(container).toHaveClass("mine");
    const inner = container.querySelector('[data-slot="sidebar-inner"]')!;
    expect(inner).toHaveAttribute("data-sidebar", "sidebar");
    for (const [slot, sidebar] of [
      ["sidebar-header", "header"],
      ["sidebar-footer", "footer"],
      ["sidebar-content", "content"],
      ["sidebar-group", "group"],
      ["sidebar-group-label", "group-label"],
      ["sidebar-group-action", "group-action"],
      ["sidebar-group-content", "group-content"],
      ["sidebar-menu", "menu"],
      ["sidebar-menu-item", "menu-item"],
      ["sidebar-menu-badge", "menu-badge"],
      ["sidebar-menu-sub", "menu-sub"],
      ["sidebar-menu-sub-item", "menu-sub-item"],
      ["sidebar-separator", "separator"],
    ])
      expect(inner.querySelector(`[data-slot="${slot}"]`)).toHaveAttribute("data-sidebar", sidebar);
    expect(inner.querySelector('[data-slot="sidebar-menu"]')!.tagName).toBe("UL");
    expect(inner.querySelector('[data-slot="sidebar-menu-item"]')!.tagName).toBe("LI");
    expect(document.querySelector('[data-slot="sidebar-inset"]')!.tagName).toBe("MAIN");
    expect(document.querySelector('[data-slot="sidebar-input"]')).toHaveAttribute("data-sidebar", "input");
  });

  it("collapsible=none renders one plain panel without state", async () => {
    render(() => (
      <SidebarProvider>
        <Sidebar collapsible="none" id="plain">
          <SidebarContent>c</SidebarContent>
        </Sidebar>
      </SidebarProvider>
    ));
    await wait();
    const r = document.getElementById("plain")!;
    expect(r).toHaveAttribute("data-slot", "sidebar");
    expect(r).not.toHaveAttribute("data-state");
    expect(r.querySelector('[data-slot="sidebar-gap"]')).toBeNull();
  });

  it("collapsed mode is keyed on collapsible: icon / offcanvas", async () => {
    render(() => <App sidebar={{ collapsible: "icon" }} />);
    await wait();
    await user.click(document.getElementById("trigger")!);
    await wait();
    expect(root()).toHaveAttribute("data-state", "collapsed");
    expect(root()).toHaveAttribute("data-collapsible", "icon");
    cleanup();
    render(() => <App provider={{ defaultOpen: false }} />);
    await wait();
    expect(root()).toHaveAttribute("data-collapsible", "offcanvas");
  });
});

describe("toggling", () => {
  it("SidebarTrigger keeps the visually hidden label next to icon children (shadcn always renders the sr-only span)", async () => {
    render(() => (
      <SidebarProvider>
        <SidebarTrigger id="icon-trigger">
          <svg aria-hidden="true" />
        </SidebarTrigger>
      </SidebarProvider>
    ));
    await wait();
    expect(document.getElementById("icon-trigger")).toHaveAccessibleName("Toggle Sidebar");
  });

  it("SidebarTrigger toggles and writes the cookie", async () => {
    let api!: SidebarContextValue;
    render(() => <App api={(a) => (api = a)} />);
    await wait();
    const trigger = document.getElementById("trigger")!;
    expect(trigger).toHaveAttribute("data-sidebar", "trigger");
    expect(trigger).toHaveAccessibleName("Toggle Sidebar");
    await user.click(trigger);
    await wait();
    expect(root()).toHaveAttribute("data-state", "collapsed");
    expect(api.state()).toBe("collapsed");
    expect(api.open()).toBe(false);
    expect(cookie()).toBe(`${SIDEBAR_COOKIE_NAME}=false`);
    await user.click(trigger);
    await wait();
    expect(root()).toHaveAttribute("data-state", "expanded");
    expect(cookie()).toBe(`${SIDEBAR_COOKIE_NAME}=true`);
  });

  it("SidebarTrigger chains the user's onPress", async () => {
    const calls: string[] = [];
    render(() => (
      <SidebarProvider>
        <Sidebar>x</Sidebar>
        <SidebarTrigger id="t" onPress={() => calls.push("user")} />
      </SidebarProvider>
    ));
    await wait();
    await user.click(document.getElementById("t")!);
    await wait();
    expect(calls).toEqual(["user"]);
    expect(root()).toHaveAttribute("data-state", "collapsed");
  });

  it("SidebarRail toggles and is not in the tab order", async () => {
    render(() => <App />);
    await wait();
    const rail = document.querySelector<HTMLElement>('[data-slot="sidebar-rail"]')!;
    expect(rail).toHaveAttribute("tabindex", "-1");
    expect(rail).toHaveAttribute("aria-label", "Toggle Sidebar");
    expect(rail).toHaveAttribute("title", "Toggle Sidebar");
    fireEvent.click(rail);
    await wait();
    expect(root()).toHaveAttribute("data-state", "collapsed");
  });

  it("Cmd+B / Ctrl+B toggles; other keys do nothing", async () => {
    render(() => <App />);
    await wait();
    const ctrl = new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(ctrl);
    await wait();
    expect(ctrl.defaultPrevented).toBe(true);
    expect(root()).toHaveAttribute("data-state", "collapsed");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true, bubbles: true, cancelable: true }));
    await wait();
    expect(root()).toHaveAttribute("data-state", "expanded");
    const plain = new KeyboardEvent("keydown", { key: "b", bubbles: true, cancelable: true });
    window.dispatchEvent(plain);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true, cancelable: true }));
    await wait();
    expect(plain.defaultPrevented).toBe(false);
    expect(root()).toHaveAttribute("data-state", "expanded");
  });

  it("controlled with a Signal: two-way, onOpenChange called", async () => {
    const open = signal(false);
    const changes: boolean[] = [];
    render(() => <App provider={{ open, onOpenChange: (v: boolean) => changes.push(v) }} />);
    await wait();
    expect(root()).toHaveAttribute("data-state", "collapsed");
    await user.click(document.getElementById("trigger")!);
    await wait();
    expect(open()).toBe(true);
    expect(changes).toEqual([true]);
    expect(root()).toHaveAttribute("data-state", "expanded");
    open.set(false);
    await wait();
    expect(root()).toHaveAttribute("data-state", "collapsed");
  });

  it("controlled with a plain value: only onOpenChange (and the cookie)", async () => {
    const changes: boolean[] = [];
    render(() => <App provider={{ open: true, onOpenChange: (v: boolean) => changes.push(v) }} />);
    await wait();
    await user.click(document.getElementById("trigger")!);
    await wait();
    expect(changes).toEqual([false]);
    expect(root()).toHaveAttribute("data-state", "expanded");
    expect(cookie()).toBe(`${SIDEBAR_COOKIE_NAME}=false`);
  });

  it("useSidebar setters", async () => {
    let api!: SidebarContextValue;
    render(() => <App api={(a) => (api = a)} />);
    await wait();
    api.setOpen((o) => !o);
    await wait();
    expect(root()).toHaveAttribute("data-state", "collapsed");
    api.setOpen(true);
    api.setOpenMobile(true);
    await wait();
    expect(api.open()).toBe(true);
    expect(api.openMobile()).toBe(true);
    expect(api.isMobile()).toBe(false);
  });
});

describe("menu parts", () => {
  it("MenuButton: link with href, button otherwise; data-active / data-size / data-variant", async () => {
    render(() => <App />);
    await wait();
    const home = document.getElementById("home")!;
    expect(home.tagName).toBe("A");
    expect(home).toHaveAttribute("href", "#home");
    expect(home).toHaveAttribute("data-active", "true");
    expect(home).toHaveAttribute("data-size", "default");
    expect(home).toHaveAttribute("data-variant", "default");
    expect(home).toHaveAttribute("data-sidebar", "menu-button");
    const inbox = document.getElementById("inbox")!;
    expect(inbox.tagName).toBe("BUTTON");
    expect(inbox).not.toHaveAttribute("data-active");
    expect(inbox).toHaveAttribute("data-size", "lg");
    expect(inbox).toHaveAttribute("data-variant", "outline");
    const sub = document.getElementById("sub")!;
    expect(sub.tagName).toBe("A");
    expect(sub).toHaveAttribute("data-size", "md");
    expect(document.getElementById("inbox-action")).toHaveAttribute("data-show-on-hover", "true");
  });

  it("isActive accepts an accessor", async () => {
    const active = signal(false);
    render(() => (
      <SidebarProvider>
        <Sidebar>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton id="b" isActive={active}>
                B
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton id="s" isActive={active} size="sm">
                    S
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </Sidebar>
      </SidebarProvider>
    ));
    await wait();
    const b = document.getElementById("b")!;
    expect(b).not.toHaveAttribute("data-active");
    active.set(true);
    await wait();
    expect(b).toHaveAttribute("data-active", "true");
    expect(document.getElementById("s")).toHaveAttribute("data-active", "true");
    expect(document.getElementById("s")).toHaveAttribute("data-size", "sm");
    expect(document.getElementById("b")).toBe(b);
  });

  it("MenuSkeleton: text width 50–90%, optional icon", async () => {
    render(() => (
      <SidebarProvider>
        <SidebarMenuSkeleton id="sk" showIcon />
        <SidebarMenuSkeleton id="sk2" />
      </SidebarProvider>
    ));
    await wait();
    const sk = document.getElementById("sk")!;
    expect(sk).toHaveAttribute("data-sidebar", "menu-skeleton");
    expect(sk.querySelector('[data-sidebar="menu-skeleton-icon"]')).not.toBeNull();
    const width = parseInt(sk.querySelector<HTMLElement>('[data-sidebar="menu-skeleton-text"]')!.style.getPropertyValue("--skeleton-width"));
    expect(width).toBeGreaterThanOrEqual(50);
    expect(width).toBeLessThan(90);
    expect(document.getElementById("sk2")!.querySelector('[data-sidebar="menu-skeleton-icon"]')).toBeNull();
  });

  it("render replaces the element (asChild)", async () => {
    render(() => (
      <SidebarProvider>
        <SidebarGroupLabel id="lbl" render={(p) => <h2 {...(p as {})} />}>
          Projects
        </SidebarGroupLabel>
      </SidebarProvider>
    ));
    await wait();
    const lbl = document.getElementById("lbl")!;
    expect(lbl.tagName).toBe("H2");
    expect(lbl).toHaveAttribute("data-sidebar", "group-label");
    expect(lbl).toHaveClass("rv-SidebarGroupLabel");
    expect(lbl).toHaveTextContent("Projects");
  });

  it("keyboard: Tab reaches every menu button / link, Enter activates", async () => {
    const pressed: string[] = [];
    render(() => (
      <SidebarProvider>
        <Sidebar>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton id="k1" onPress={() => pressed.push("k1")}>
                One
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton id="k2" href="#k2">
                Two
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarRail />
        </Sidebar>
      </SidebarProvider>
    ));
    await wait();
    await user.tab();
    expect(document.activeElement?.id).toBe("k1");
    await user.keyboard("{Enter}");
    await wait();
    expect(pressed).toEqual(["k1"]);
    await user.tab();
    expect(document.activeElement?.id).toBe("k2");
    await user.tab();
    // The rail is skipped (tabindex -1).
    expect(document.activeElement).toBe(document.body);
  });
});

describe("tooltips", () => {
  it("only while collapsed", async () => {
    render(() => <App sidebar={{ collapsible: "icon" }} />);
    await wait();
    const inbox = document.getElementById("inbox")!;
    fireEvent.pointerMove(document.body, { pointerType: "mouse" });
    await user.hover(inbox);
    await wait();
    expect(screen().queryByRole("tooltip")).toBeNull();
    await user.unhover(inbox);
    await user.click(document.getElementById("trigger")!);
    await wait();
    expect(root()).toHaveAttribute("data-state", "collapsed");
    fireEvent.pointerMove(document.body, { pointerType: "mouse" });
    await user.hover(inbox);
    await wait();
    const tip = screen().getByRole("tooltip");
    expect(tip).toHaveTextContent("Inbox");
    expect(tip).toHaveAttribute("data-placement", "right");
    expect(inbox).toHaveAttribute("aria-describedby", tip.id);
  });
});

describe("mobile", () => {
  it("below 768px the sidebar is a modal sheet opened by the trigger", async () => {
    setWidth(500);
    let api!: SidebarContextValue;
    render(() => <App api={(a) => (api = a)} sidebar={{ side: "right" }} />);
    await wait();
    // `useSidebar().isMobile()` answers from the viewport; nothing re-renders at load (the desktop parts stay,
    // hidden by CSS below 768 px) until the first toggle re-reads the width.
    expect(api.isMobile()).toBe(true);
    expect(document.querySelector('[data-slot="sidebar-container"]')).not.toBeNull();
    expect(screen().queryByRole("dialog")).toBeNull();
    await user.click(document.getElementById("trigger")!);
    await wait(80);
    // Desktop parts gone once the toggle switched to the sheet.
    expect(document.querySelector('[data-slot="sidebar-container"]')).toBeNull();
    expect(api.openMobile()).toBe(true);
    // Desktop state untouched: the trigger toggles the sheet on mobile.
    expect(api.open()).toBe(true);
    const dialog = screen().getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Sidebar");
    expect(dialog).toHaveAccessibleDescription("Displays the mobile sidebar.");
    const sheet = document.querySelector<HTMLElement>('[data-mobile="true"]')!;
    expect(sheet).toHaveAttribute("data-slot", "sidebar");
    expect(sheet).toHaveAttribute("data-sidebar", "sidebar");
    expect(sheet).toHaveAttribute("data-side", "right");
    expect(sheet).toHaveClass("rv-Sidebar-sheet");
    expect(sheet.style.getPropertyValue("--sidebar-width")).toBe("var(--sidebar-width-mobile, 18rem)");
    expect(dialog).toHaveTextContent("Inbox");
    await user.keyboard("{Escape}");
    await wait(80);
    expect(api.openMobile()).toBe(false);
    await wait(400);
    expect(screen().queryByRole("dialog")).toBeNull();
  });

  it("Ctrl+B toggles the sheet on mobile", async () => {
    setWidth(500);
    let api!: SidebarContextValue;
    render(() => <App api={(a) => (api = a)} />);
    await wait();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true, cancelable: true }));
    await wait(80);
    expect(api.openMobile()).toBe(true);
    expect(screen().getByRole("dialog")).toBeInTheDocument();
  });
});

describe("collapsible group (Disclosure)", () => {
  it("a group label rendered as the Disclosure trigger toggles the panel", async () => {
    render(() => (
      <SidebarProvider>
        <Sidebar>
          <Disclosure defaultExpanded>
            <SidebarGroup>
              <SidebarGroupLabel id="help" render={(p) => <Button slot="trigger" {...(p as {})} />}>
                Help
              </SidebarGroupLabel>
              <DisclosurePanel>
                <SidebarGroupContent id="help-content">content</SidebarGroupContent>
              </DisclosurePanel>
            </SidebarGroup>
          </Disclosure>
        </Sidebar>
      </SidebarProvider>
    ));
    await wait();
    const label = document.getElementById("help")!;
    expect(label.tagName).toBe("BUTTON");
    expect(label).toHaveAttribute("aria-expanded", "true");
    expect(label).toHaveAttribute("data-sidebar", "group-label");
    await user.click(label);
    await wait();
    expect(label).toHaveAttribute("aria-expanded", "false");
  });
});

describe("sidebarCookieOpen", () => {
  it("parses headers, maps and values", () => {
    expect(sidebarCookieOpen("a=1; sidebar_state=false; b=2")).toBe(false);
    expect(sidebarCookieOpen("sidebar_state=true")).toBe(true);
    expect(sidebarCookieOpen("true")).toBe(true);
    expect(sidebarCookieOpen(new Map([["sidebar_state", "false"]]))).toBe(false);
    expect(sidebarCookieOpen("other=1")).toBeUndefined();
    expect(sidebarCookieOpen("sidebar_state=maybe")).toBeUndefined();
    expect(sidebarCookieOpen(null)).toBeUndefined();
  });
});
