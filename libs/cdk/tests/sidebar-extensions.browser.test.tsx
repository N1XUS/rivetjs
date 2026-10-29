// Behaviour tests for the Rivet extensions of `@rivetjs/cdk/sidebar` (feature set inspired by commercial UI kits' public
// Sidebar docs; independent implementation): provider defaults (side / variant / collapsible), `toggleShortcut`,
// `reduceMotion`, `navigate`, tree items (expandable SidebarMenuItem + SidebarMenuTrigger / SidebarMenuIndicator),
// guide lines, `isCurrent` / `forceReload` / external links, `closeMobileOnAction`, SidebarMenuActions, the mobile
// `backdrop`, SidebarPages.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { _resetTooltips } from "../state/tooltip.ts";
import {
  SIDEBAR_COOKIE_NAME,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuActions,
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
  matchesSidebarShortcut,
  parseSidebarShortcut,
  useSidebar,
  useSidebarPages,
  type SidebarContextValue,
  type SidebarPagesContextValue,
  type SidebarProviderProps,
} from "../sidebar/index.tsx";

const screen = () => within(document.body);
const wait = async (ms = 30) => {
  await flush();
  await new Promise((resolve) => setTimeout(resolve, ms));
  await flush();
};
const root = () => document.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
const clearCookie = () => (document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`);
const key = (init: KeyboardEventInit) => window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));

let user: ReturnType<typeof userEvent.setup>;
const realWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
const setWidth = (w: number) => Object.defineProperty(window, "innerWidth", { configurable: true, get: () => w });

beforeEach(() => {
  user = userEvent.setup({ delay: null });
  clearCookie();
  setWidth(1024);
});
afterEach(async () => {
  cleanup();
  _resetTooltips();
  if (realWidth) Object.defineProperty(window, "innerWidth", realWidth);
  clearCookie();
  await flush();
});

function Shell(props: {
  provider?: Partial<SidebarProviderProps>;
  sidebar?: Record<string, unknown>;
  api?: (api: SidebarContextValue) => void;
  children?: unknown;
}) {
  const Probe = () => {
    props.api?.(useSidebar());
    return null;
  };
  return (
    <SidebarProvider {...(props.provider ?? {})}>
      <Probe />
      <Sidebar {...(props.sidebar ?? {})}>
        <SidebarContent>{props.children as never}</SidebarContent>
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger id="trigger" />
      </SidebarInset>
    </SidebarProvider>
  );
}

describe("provider defaults", () => {
  it("side / variant / collapsible on the provider; the Sidebar's own props win", async () => {
    render(() => <Shell provider={{ side: "right", variant: "floating", collapsible: "icon" }} />);
    await wait();
    expect(root()).toHaveAttribute("data-side", "right");
    expect(root()).toHaveAttribute("data-variant", "floating");
    await user.click(document.getElementById("trigger")!);
    expect(root()).toHaveAttribute("data-collapsible", "icon");
    cleanup();
    render(() => <Shell provider={{ side: "right", variant: "floating" }} sidebar={{ side: "left", variant: "inset" }} />);
    await wait();
    expect(root()).toHaveAttribute("data-side", "left");
    expect(root()).toHaveAttribute("data-variant", "inset");
    await user.click(document.getElementById("trigger")!);
    // shadcn default kept.
    expect(root()).toHaveAttribute("data-collapsible", "offcanvas");
  });

  it("reduceMotion marks the wrapper", async () => {
    render(() => <Shell provider={{ reduceMotion: true }} />);
    await wait();
    expect(document.querySelector('[data-slot="sidebar-wrapper"]')).toHaveAttribute("data-reduce-motion", "true");
    cleanup();
    render(() => <Shell />);
    await wait();
    expect(document.querySelector('[data-slot="sidebar-wrapper"]')).not.toHaveAttribute("data-reduce-motion");
  });
});

describe("toggleShortcut", () => {
  it("parses modifiers and keys", () => {
    expect(parseSidebarShortcut("mod+b")).toEqual({ key: "b", mod: true, meta: false, ctrl: false, shift: false, alt: false });
    expect(parseSidebarShortcut("Mod+Shift+S")).toEqual({ key: "s", mod: true, meta: false, ctrl: false, shift: true, alt: false });
    expect(parseSidebarShortcut("cmd+alt+k")).toMatchObject({ key: "k", meta: true, alt: true, mod: false });
    expect(parseSidebarShortcut("ctrl++")).toMatchObject({ key: "+", ctrl: true });
    expect(parseSidebarShortcut("mod+")).toBeNull();
    expect(parseSidebarShortcut("shift")).toBeNull();
    expect(parseSidebarShortcut("hyper+b")).toBeNull();
  });

  it("matches exactly: shift / alt must match, mod = Cmd or Ctrl, code fallback", () => {
    const spec = parseSidebarShortcut("mod+shift+s")!;
    expect(matchesSidebarShortcut(new KeyboardEvent("keydown", { key: "S", metaKey: true, shiftKey: true }), spec)).toBe(true);
    expect(matchesSidebarShortcut(new KeyboardEvent("keydown", { key: "S", ctrlKey: true, shiftKey: true }), spec)).toBe(true);
    expect(matchesSidebarShortcut(new KeyboardEvent("keydown", { key: "s", metaKey: true }), spec)).toBe(false);
    const alt = parseSidebarShortcut("alt+k")!;
    expect(matchesSidebarShortcut(new KeyboardEvent("keydown", { key: "˚", code: "KeyK", altKey: true }), alt)).toBe(true);
    expect(matchesSidebarShortcut(new KeyboardEvent("keydown", { key: "k", code: "KeyK", altKey: true, ctrlKey: true }), alt)).toBe(false);
    const ctrl = parseSidebarShortcut("ctrl+b")!;
    expect(matchesSidebarShortcut(new KeyboardEvent("keydown", { key: "b", metaKey: true }), ctrl)).toBe(false);
  });

  it("a custom shortcut toggles; the default no longer does", async () => {
    let api!: SidebarContextValue;
    render(() => <Shell provider={{ toggleShortcut: "mod+shift+s" }} api={(a) => (api = a)} />);
    await wait();
    key({ key: "b", ctrlKey: true });
    await wait();
    expect(api.open()).toBe(true);
    key({ key: "S", ctrlKey: true, shiftKey: true });
    await wait();
    expect(api.open()).toBe(false);
  });

  it("false / null disable the shortcut", async () => {
    for (const toggleShortcut of [false, null] as const) {
      let api!: SidebarContextValue;
      render(() => <Shell provider={{ toggleShortcut }} api={(a) => (api = a)} />);
      await wait();
      const event = new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true, cancelable: true });
      window.dispatchEvent(event);
      await wait();
      expect(api.open()).toBe(true);
      expect(event.defaultPrevented).toBe(false);
      cleanup();
    }
  });
});

function Tree(props: { showGuideLines?: boolean | "hover"; onExpandedChange?: (v: boolean) => void }) {
  return (
    <Shell>
      <SidebarMenu showGuideLines={props.showGuideLines}>
        <SidebarMenuItem id="projects" defaultExpanded onExpandedChange={props.onExpandedChange}>
          <SidebarMenuTrigger id="projects-trigger">
            <span>Projects</span>
            <SidebarMenuIndicator>
              <i />
            </SidebarMenuIndicator>
          </SidebarMenuTrigger>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton id="alpha" href="#alpha">
                Alpha
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            <SidebarMenuSubItem expandable>
              <SidebarMenuTrigger id="archive-trigger">
                <span>Archive</span>
              </SidebarMenuTrigger>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton id="old" href="#old">
                    Old
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </SidebarMenuItem>
        <SidebarMenuItem id="plain">
          <SidebarMenuButton>Plain</SidebarMenuButton>
          <SidebarMenuSub id="plain-sub">
            <SidebarMenuSubItem>x</SidebarMenuSubItem>
          </SidebarMenuSub>
        </SidebarMenuItem>
      </SidebarMenu>
    </Shell>
  );
}

describe("tree menu", () => {
  it("an expandable item is a Disclosure li; the trigger toggles its sub menu panel", async () => {
    const changes: boolean[] = [];
    render(() => <Tree onExpandedChange={(v) => changes.push(v)} />);
    await wait();
    const item = document.getElementById("projects")!;
    expect(item.tagName).toBe("LI");
    expect(item).toHaveAttribute("data-slot", "sidebar-menu-item");
    expect(item).toHaveAttribute("data-expandable", "true");
    expect(item).toHaveAttribute("data-expanded", "true");
    expect(item).toHaveClass("rv-SidebarMenuItem");
    const trigger = document.getElementById("projects-trigger")!;
    expect(trigger).toHaveAttribute("data-slot", "sidebar-menu-button");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panel = item.querySelector<HTMLElement>(':scope > [data-slot="sidebar-menu-sub-panel"]')!;
    expect(panel).toHaveAttribute("role", "group");
    expect(panel).toHaveClass("rv-SidebarMenuSub-panel");
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.querySelector(':scope > [data-slot="sidebar-menu-sub"]')).not.toBeNull();
    const indicator = trigger.querySelector('[data-slot="sidebar-menu-indicator"]')!;
    expect(indicator).toHaveAttribute("aria-hidden", "true");
    expect(indicator).toHaveClass("rv-SidebarMenuIndicator");
    await user.click(trigger);
    await wait();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(item).not.toHaveAttribute("data-expanded");
    expect(panel).toHaveAttribute("hidden");
    expect(changes).toEqual([false]);
    // Keyboard (APG disclosure navigation): Enter / Space on the focused trigger.
    trigger.focus();
    await user.keyboard("{Enter}");
    await wait();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard(" ");
    await wait();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("nested expandable sub items; a plain item's sub menu stays a plain list", async () => {
    render(() => <Tree />);
    await wait();
    const archive = document.getElementById("archive-trigger")!;
    expect(archive).toHaveAttribute("aria-expanded", "false");
    expect(archive.closest("li")).toHaveAttribute("data-slot", "sidebar-menu-sub-item");
    const nestedPanel = archive.closest("li")!.querySelector<HTMLElement>(':scope > [data-slot="sidebar-menu-sub-panel"]')!;
    expect(nestedPanel).toHaveAttribute("hidden");
    await user.click(archive);
    await wait();
    expect(nestedPanel).not.toHaveAttribute("hidden");
    expect(document.getElementById("old")).toBeVisible();
    // Not expandable: no Disclosure, no panel.
    const plainSub = document.getElementById("plain-sub")!;
    expect(plainSub.parentElement).toBe(document.getElementById("plain"));
    expect(document.getElementById("plain")).not.toHaveAttribute("data-expandable");
  });

  it("showGuideLines: true (default, no attribute) / hover / false", async () => {
    render(() => <Tree />);
    await wait();
    expect(document.querySelector('[data-slot="sidebar-menu"]')).not.toHaveAttribute("data-guide-lines");
    cleanup();
    render(() => <Tree showGuideLines="hover" />);
    await wait();
    expect(document.querySelector('[data-slot="sidebar-menu"]')).toHaveAttribute("data-guide-lines", "hover");
    cleanup();
    render(() => <Tree showGuideLines={false} />);
    await wait();
    expect(document.querySelector('[data-slot="sidebar-menu"]')).toHaveAttribute("data-guide-lines", "none");
  });
});

describe("menu links", () => {
  it("isCurrent → aria-current=page + data-active; accessor; isActive wins", async () => {
    const flag = () => true;
    render(() => (
      <Shell>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton id="a" href="#a" isCurrent>
              A
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton id="b" href="#b" isCurrent={flag}>
              B
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton id="c" href="#c" isCurrent isActive={false}>
              C
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSubButton id="d" href="#d" isCurrent>
              D
            </SidebarMenuSubButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </Shell>
    ));
    await wait();
    expect(document.getElementById("a")).toHaveAttribute("aria-current", "page");
    expect(document.getElementById("a")).toHaveAttribute("data-active", "true");
    expect(document.getElementById("b")).toHaveAttribute("aria-current", "page");
    expect(document.getElementById("c")).toHaveAttribute("aria-current", "page");
    expect(document.getElementById("c")).not.toHaveAttribute("data-active");
    expect(document.getElementById("d")).toHaveAttribute("aria-current", "page");
  });

  it("forceReload marks a document link; external http(s) hrefs open in a new tab", async () => {
    render(() => (
      <Shell>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton id="reload" href="/docs" forceReload>
              Docs
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton id="ext" href="https://example.com/">
              Example
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton id="ext-self" href="https://example.com/" target="_self">
              Same tab
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSubButton id="sub-reload" href="/x" forceReload>
              X
            </SidebarMenuSubButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </Shell>
    ));
    await wait();
    expect(document.getElementById("reload")).toHaveAttribute("data-rivet-reload", "");
    expect(document.getElementById("reload")).not.toHaveAttribute("target");
    expect(document.getElementById("ext")).toHaveAttribute("target", "_blank");
    expect(document.getElementById("ext")).toHaveAttribute("rel", "noopener noreferrer");
    expect(document.getElementById("ext-self")).toHaveAttribute("target", "_self");
    expect(document.getElementById("sub-reload")).toHaveAttribute("data-rivet-reload", "");
  });

  it("provider navigate routes link presses; forceReload links stay native", async () => {
    const calls: string[] = [];
    let reloadClicked = false;
    render(() => (
      <Shell provider={{ navigate: (href: string) => calls.push(href) }}>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton id="routed" href="/inbox">
              Inbox
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton id="native" href="#native" forceReload onPress={() => (reloadClicked = true)}>
              Native
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </Shell>
    ));
    await wait();
    await user.click(document.getElementById("routed")!);
    await wait();
    expect(calls).toEqual(["/inbox"]);
    await user.click(document.getElementById("native")!);
    await wait();
    expect(reloadClicked).toBe(true);
    expect(calls).toEqual(["/inbox"]);
  });
});

describe("closeMobileOnAction", () => {
  function Mobile(props: { provider?: boolean; group?: boolean; menu?: boolean; item?: boolean; api: (a: SidebarContextValue) => void }) {
    return (
      <Shell provider={props.provider === undefined ? {} : { closeMobileOnAction: props.provider }} api={props.api}>
        <SidebarGroup closeMobileOnAction={props.group}>
          <SidebarMenu closeMobileOnAction={props.menu}>
            <SidebarMenuItem>
              <SidebarMenuButton id="act" closeMobileOnAction={props.item}>
                Act
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem expandable>
              <SidebarMenuTrigger id="tt">Tree</SidebarMenuTrigger>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton id="leaf">Leaf</SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </Shell>
    );
  }
  const openSheet = async () => {
    await user.click(document.getElementById("trigger")!);
    await wait(80);
  };

  it("default (= shadcn): a menu button press keeps the sheet open", async () => {
    setWidth(500);
    let api!: SidebarContextValue;
    render(() => <Mobile api={(a) => (api = a)} />);
    await wait();
    await openSheet();
    await user.click(document.getElementById("act")!);
    await wait();
    expect(api.openMobile()).toBe(true);
  });

  it("provider true: a menu button press closes the sheet; a tree trigger does not", async () => {
    setWidth(500);
    let api!: SidebarContextValue;
    render(() => <Mobile provider api={(a) => (api = a)} />);
    await wait();
    await openSheet();
    expect(api.openMobile()).toBe(true);
    await user.click(document.getElementById("tt")!);
    await wait();
    expect(api.openMobile()).toBe(true);
    await user.click(document.getElementById("leaf")!);
    await wait();
    expect(api.openMobile()).toBe(false);
  });

  it("levels: provider false, group / menu / item override", async () => {
    setWidth(500);
    const cases: [Partial<Parameters<typeof Mobile>[0]>, boolean][] = [
      [{ provider: false }, true],
      [{ provider: false, group: true }, false],
      [{ group: false }, true],
      [{ group: false, menu: true }, false],
      [{ menu: false, item: true }, false],
      [{ item: false }, true],
    ];
    for (const [levels, staysOpen] of cases) {
      let api!: SidebarContextValue;
      render(() => <Mobile {...levels} api={(a) => (api = a)} />);
      await wait();
      await openSheet();
      await user.click(document.getElementById("act")!);
      await wait();
      expect([levels, api.openMobile()]).toEqual([levels, staysOpen]);
      cleanup();
      await wait(50);
    }
  });

  it("the sheet underlay carries the backdrop (default blur)", async () => {
    setWidth(500);
    render(() => <Mobile api={() => {}} />);
    await wait();
    await openSheet();
    expect(document.querySelector(".rv-Sidebar-overlay")).toHaveAttribute("data-backdrop", "blur");
    cleanup();
    await wait(50);
    render(() => (
      <Shell sidebar={{ backdrop: "transparent" }} provider={{ reduceMotion: true }}>
        x
      </Shell>
    ));
    await wait();
    await openSheet();
    const overlay = document.querySelector(".rv-Sidebar-overlay")!;
    expect(overlay).toHaveAttribute("data-backdrop", "transparent");
    expect(overlay).toHaveAttribute("data-reduce-motion", "true");
    expect(document.querySelector('[data-mobile="true"]')).toHaveAttribute("data-reduce-motion", "true");
  });
});

describe("SidebarMenuActions", () => {
  it("groups several actions at the item end", async () => {
    const pressed: string[] = [];
    render(() => (
      <Shell>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>Item</SidebarMenuButton>
            <SidebarMenuActions id="actions" showOnHover aria-label="Item actions">
              <SidebarMenuAction id="edit" aria-label="Edit" onPress={() => pressed.push("edit")} />
              <SidebarMenuAction id="delete" aria-label="Delete" onPress={() => pressed.push("delete")} />
            </SidebarMenuActions>
          </SidebarMenuItem>
        </SidebarMenu>
      </Shell>
    ));
    await wait();
    const actions = document.getElementById("actions")!;
    expect(actions).toHaveAttribute("role", "group");
    expect(actions).toHaveAttribute("data-slot", "sidebar-menu-actions");
    expect(actions).toHaveAttribute("data-show-on-hover", "true");
    expect(actions).toHaveAccessibleName("Item actions");
    expect(within(actions).getAllByRole("button")).toHaveLength(2);
    await user.click(document.getElementById("delete")!);
    await user.click(document.getElementById("edit")!);
    expect(pressed).toEqual(["delete", "edit"]);
  });
});

describe("SidebarPages", () => {
  function Pages(props: { defaultValue?: string; reduceMotion?: boolean; onValueChange?: (v: string) => void; api: (a: SidebarPagesContextValue) => void }) {
    const Probe = () => {
      props.api(useSidebarPages());
      return null;
    };
    return (
      <Shell>
        <SidebarPages defaultValue={props.defaultValue} reduceMotion={props.reduceMotion} onValueChange={props.onValueChange} id="pages">
          <Probe />
          <SidebarPage value="main" aria-label="Main">
            <button id="to-settings">Settings</button>
          </SidebarPage>
          <SidebarPage value="settings" aria-label="Settings">
            <button id="back">Back</button>
          </SidebarPage>
        </SidebarPages>
      </Shell>
    );
  }
  const page = (v: string) => document.querySelector<HTMLElement>(`[data-slot="sidebar-page"][data-value="${v}"]`)!;

  it("first page active by default; inactive pages hidden, inert, aria-hidden", async () => {
    let api!: SidebarPagesContextValue;
    render(() => <Pages api={(a) => (api = a)} />);
    await wait();
    const pages = document.getElementById("pages")!;
    expect(pages).toHaveAttribute("data-slot", "sidebar-pages");
    expect(pages.style.display).toBe("grid");
    expect(page("main")).toHaveAttribute("data-active", "true");
    expect(page("main")).not.toHaveAttribute("hidden");
    expect(page("settings")).toHaveAttribute("hidden");
    expect(page("settings")).toHaveAttribute("inert");
    expect(page("settings")).toHaveAttribute("aria-hidden", "true");
    expect(api.activeValue()).toBe("main");
    expect(api.order()).toEqual(["main", "settings"]);
    expect(api.activeIndex()).toBe(0);
  });

  it("reduceMotion: an instant switch, onValueChange, focus follows", async () => {
    let api!: SidebarPagesContextValue;
    const changes: string[] = [];
    render(() => <Pages reduceMotion onValueChange={(v) => changes.push(v)} api={(a) => (api = a)} />);
    await wait();
    document.getElementById("to-settings")!.focus();
    api.setActiveValue("settings");
    await wait();
    expect(changes).toEqual(["settings"]);
    expect(page("settings")).not.toHaveAttribute("hidden");
    expect(page("settings")).not.toHaveAttribute("inert");
    expect(page("main")).toHaveAttribute("hidden");
    expect(page("main")).toHaveAttribute("inert");
    expect(document.activeElement).toBe(document.getElementById("back"));
    expect(api.activeIndex()).toBe(1);
    // Same value: no change.
    api.setActiveValue("settings");
    await wait();
    expect(changes).toEqual(["settings"]);
  });

  it("animated: both pages slide, the leaving one is hidden when the motion settles", async () => {
    let api!: SidebarPagesContextValue;
    render(() => <Pages defaultValue="settings" api={(a) => (api = a)} />);
    await wait();
    expect(page("settings")).not.toHaveAttribute("hidden");
    api.setActiveValue("main");
    await flush();
    await new Promise((r) => setTimeout(r, 40));
    // Mid-motion: both visible, the leaving page moving (back = towards the end).
    expect(page("main")).not.toHaveAttribute("hidden");
    expect(page("settings")).not.toHaveAttribute("hidden");
    expect(page("settings")).toHaveAttribute("inert");
    await vi.waitFor(() => expect(page("settings")).toHaveAttribute("hidden"), { timeout: 3000, interval: 20 });
    expect(page("settings").style.transform).toBe("");
    expect(page("main").style.transform).toBe("");
  });
});
