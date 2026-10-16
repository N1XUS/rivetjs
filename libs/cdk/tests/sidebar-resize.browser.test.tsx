// Rivet extension `Sidebar resizable` (`../sidebar/resize.ts`; no shadcn counterpart): WAI-ARIA window-splitter handle on
// the panel's inner edge. Pointer drag (clamped to min / max, collapse below half the minimum, re-open when dragged
// back out), keyboard (arrows ± step, Shift × 5, Home / End, Enter toggles), double-click reset, mirrored for a right
// sidebar and RTL, `onWidthChange` (live) / `onWidthChangeEnd` (committed), two-way Signal `width`.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent } from "@testing-library/dom";
import "../theme.css";
import { SIDEBAR_COOKIE_NAME, Sidebar, SidebarContent, SidebarInset, SidebarProvider, type SidebarProps } from "../sidebar/index.tsx";

const realWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
const setWidth = (w: number) => Object.defineProperty(window, "innerWidth", { configurable: true, get: () => w });
const root = () => document.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
const handle = () => document.querySelector<HTMLElement>('[data-slot="sidebar-resize-handle"]')!;
const gapBox = () => document.querySelector<HTMLElement>('[data-slot="sidebar-gap"]')!.getBoundingClientRect();
const gapWidth = () => document.querySelector<HTMLElement>('[data-slot="sidebar-gap"]')!.getBoundingClientRect().width;
const wait = async (ms = 0) => {
  await flush();
  await new Promise((resolve) => setTimeout(resolve, ms));
  await flush();
};

function App(props: { sidebar?: Partial<SidebarProps>; dir?: "rtl" | "ltr" }) {
  return (
    <div dir={props.dir ?? "ltr"}>
      <SidebarProvider reduceMotion style={{ "--sidebar-width": "256px" }}>
        <Sidebar resizable minWidth={200} maxWidth={400} {...(props.sidebar ?? {})}>
          <SidebarContent>Chats</SidebarContent>
        </Sidebar>
        <SidebarInset>Main</SidebarInset>
      </SidebarProvider>
    </div>
  );
}

/** Drags the handle by `dx` px in `steps` moves (synthetic pointer events, one pointer). */
async function drag(dx: number, steps = 4): Promise<void> {
  const h = handle();
  const box = h.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + 50;
  fireEvent.pointerDown(h, { pointerId: 7, button: 0, clientX: x, clientY: y });
  for (let i = 1; i <= steps; i++) fireEvent.pointerMove(h, { pointerId: 7, clientX: x + (dx * i) / steps, clientY: y });
  fireEvent.pointerUp(h, { pointerId: 7, clientX: x + dx, clientY: y });
  await wait();
}

// The vitest iframe is narrower than 768 px, where theme.css hides the desktop panel (the mobile sheet takes over).
const desktop = document.createElement("style");
desktop.textContent = ".rv-Sidebar[data-state] { display: block; }";
document.head.append(desktop);

beforeEach(() => {
  setWidth(1280);
  document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`;
});
afterEach(() => {
  cleanup();
  if (realWidth) Object.defineProperty(window, "innerWidth", realWidth);
});

describe("Sidebar resizable", () => {
  it("renders nothing extra without `resizable`", async () => {
    render(() => (
      <SidebarProvider>
        <Sidebar>
          <SidebarContent>Chats</SidebarContent>
        </Sidebar>
      </SidebarProvider>
    ));
    await wait();
    expect(document.querySelector('[data-slot="sidebar-resize-handle"]')).toBeNull();
    expect(root().getAttribute("style")).toBeNull();
  });

  it("renders a window-splitter handle in the container", async () => {
    render(() => <App />);
    await wait();
    const h = handle();
    expect(h).toHaveAttribute("role", "separator");
    expect(h).toHaveAttribute("aria-orientation", "vertical");
    expect(h).toHaveAttribute("aria-label", "Resize sidebar");
    expect(h).toHaveAttribute("tabindex", "0");
    expect(h).toHaveAttribute("aria-valuemin", "200");
    expect(h).toHaveAttribute("aria-valuemax", "400");
    expect(h).toHaveClass("rv-SidebarResizeHandle");
    expect(h.style.touchAction).toBe("none");
    expect(h.parentElement).toHaveAttribute("data-slot", "sidebar-container");
    // No width override until the first resize: the provider's variable.
    expect(root().style.getPropertyValue("--sidebar-width")).toBe("");
    expect(gapWidth()).toBe(256);
  });

  it("drag changes the width (live onWidthChange, committed onWidthChangeEnd)", async () => {
    const live: number[] = [];
    const ends: number[] = [];
    render(() => <App sidebar={{ onWidthChange: (w) => live.push(w), onWidthChangeEnd: (w) => ends.push(w) }} />);
    await wait();
    await drag(60);
    expect(root().style.getPropertyValue("--sidebar-width")).toBe("316px");
    expect(gapWidth()).toBe(316);
    expect(handle()).toHaveAttribute("aria-valuenow", "316");
    expect(live.length).toBeGreaterThan(1);
    expect(live[live.length - 1]).toBe(316);
    expect(ends).toEqual([316]);
    expect(handle()).not.toHaveAttribute("data-dragging");
    expect(root()).not.toHaveAttribute("data-resizing");
  });

  it("marks the drag (data-dragging on the handle, data-resizing on the root)", async () => {
    render(() => <App />);
    await wait();
    const h = handle();
    const x = h.getBoundingClientRect().left;
    fireEvent.pointerDown(h, { pointerId: 3, button: 0, clientX: x, clientY: 40 });
    fireEvent.pointerMove(h, { pointerId: 3, clientX: x + 10, clientY: 40 });
    expect(h).toHaveAttribute("data-dragging", "true");
    expect(root()).toHaveAttribute("data-resizing", "true");
    fireEvent.pointerCancel(h, { pointerId: 3 });
    expect(h).not.toHaveAttribute("data-dragging");
    expect(root()).not.toHaveAttribute("data-resizing");
  });

  it("ignores secondary buttons", async () => {
    render(() => <App />);
    await wait();
    const h = handle();
    fireEvent.pointerDown(h, { pointerId: 2, button: 2, clientX: 256, clientY: 40 });
    fireEvent.pointerMove(h, { pointerId: 2, clientX: 300, clientY: 40 });
    await wait();
    expect(root().style.getPropertyValue("--sidebar-width")).toBe("");
  });

  it("clamps to minWidth / maxWidth", async () => {
    render(() => <App sidebar={{ collapseBelowMin: false }} />);
    await wait();
    await drag(500);
    expect(gapWidth()).toBe(400);
    await drag(-500);
    expect(gapWidth()).toBe(200);
    expect(root()).toHaveAttribute("data-state", "expanded");
  });

  it("collapses below half the minimum (offcanvas) and re-opens when dragged back out", async () => {
    const opens: boolean[] = [];
    render(() => (
      <div>
        <SidebarProvider reduceMotion style={{ "--sidebar-width": "256px" }} onOpenChange={(o) => opens.push(o)}>
          <Sidebar resizable minWidth={200} maxWidth={400}>
            <SidebarContent>Chats</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </div>
    ));
    await wait();
    const h = handle();
    const x = h.getBoundingClientRect().left + 4;
    fireEvent.pointerDown(h, { pointerId: 1, button: 0, clientX: x, clientY: 40 });
    // 256 → 156: below the minimum but above its half: clamped.
    fireEvent.pointerMove(h, { pointerId: 1, clientX: x - 100, clientY: 40 });
    await wait();
    expect(root()).toHaveAttribute("data-state", "expanded");
    expect(gapWidth()).toBe(200);
    // 256 → 56 (< 100): collapses (cookie + onOpenChange as a toggle).
    fireEvent.pointerMove(h, { pointerId: 1, clientX: x - 200, clientY: 40 });
    await wait();
    expect(root()).toHaveAttribute("data-state", "collapsed");
    expect(root()).toHaveAttribute("data-collapsible", "offcanvas");
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE_NAME}=false`);
    // Back out to 256 + 40: re-opens at the pointer.
    fireEvent.pointerMove(h, { pointerId: 1, clientX: x + 40, clientY: 40 });
    await wait();
    expect(root()).toHaveAttribute("data-state", "expanded");
    expect(root().style.getPropertyValue("--sidebar-width")).toBe("296px");
    fireEvent.pointerUp(h, { pointerId: 1, clientX: x + 40, clientY: 40 });
    expect(opens).toEqual([false, true]);
  });

  it("collapses to the icon rail with collapsible='icon' and expands by dragging the rail", async () => {
    render(() => <App sidebar={{ collapsible: "icon" }} />);
    await wait();
    await drag(-220);
    expect(root()).toHaveAttribute("data-state", "collapsed");
    expect(root()).toHaveAttribute("data-collapsible", "icon");
    expect(gapWidth()).toBe(48);
    // From the 48 px rail: + 160 → 208 (above half the minimum) opens.
    await drag(160);
    expect(root()).toHaveAttribute("data-state", "expanded");
    expect(gapWidth()).toBe(208);
  });

  it("keyboard: arrows ± step (Shift × 5), Home / End, Enter toggles", async () => {
    const ends: number[] = [];
    render(() => <App sidebar={{ resizeStep: 10, onWidthChangeEnd: (w) => ends.push(w) }} />);
    await wait();
    const h = handle();
    h.focus();
    await wait();
    expect(h).toHaveAttribute("aria-valuenow", "256");
    fireEvent.keyDown(h, { key: "ArrowRight" });
    await wait();
    expect(gapWidth()).toBe(266);
    fireEvent.keyDown(h, { key: "ArrowLeft", shiftKey: true });
    await wait();
    expect(gapWidth()).toBe(216);
    fireEvent.keyDown(h, { key: "End" });
    await wait();
    expect(gapWidth()).toBe(400);
    expect(h).toHaveAttribute("aria-valuenow", "400");
    fireEvent.keyDown(h, { key: "Home" });
    await wait();
    expect(gapWidth()).toBe(200);
    expect(ends).toEqual([266, 216, 400, 200]);
    fireEvent.keyDown(h, { key: "Enter" });
    await wait();
    expect(root()).toHaveAttribute("data-state", "collapsed");
    fireEvent.keyDown(h, { key: "Enter" });
    await wait();
    expect(root()).toHaveAttribute("data-state", "expanded");
  });

  it("double-click resets to defaultWidth (or the provider's width) and opens", async () => {
    render(() => <App sidebar={{ defaultWidth: 300 }} />);
    await wait();
    expect(gapWidth()).toBe(300);
    await drag(50);
    expect(gapWidth()).toBe(350);
    fireEvent.dblClick(handle());
    await wait();
    expect(gapWidth()).toBe(300);
    cleanup();
    render(() => <App />);
    await wait();
    await drag(-30);
    expect(gapWidth()).toBe(226);
    fireEvent.dblClick(handle());
    await wait();
    expect(gapWidth()).toBe(256);
  });

  it("a right sidebar grows to the left (pointer + arrows mirrored)", async () => {
    render(() => <App sidebar={{ side: "right" }} />);
    await wait();
    await drag(-40);
    expect(gapWidth()).toBe(296);
    const h = handle();
    fireEvent.keyDown(h, { key: "ArrowLeft" });
    await wait();
    expect(gapWidth()).toBe(312);
  });

  it("RTL: a start sidebar (on the right) grows to the left", async () => {
    render(() => <App dir="rtl" />);
    await wait();
    expect(gapBox().right).toBeGreaterThan(document.documentElement.clientWidth / 2);
    await drag(-40);
    expect(gapWidth()).toBe(296);
    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    await wait();
    expect(gapWidth()).toBe(280);
  });

  it("two-way Signal width follows the drag and external writes", async () => {
    const width = signal<number | string | undefined>(240);
    render(() => <App sidebar={{ width }} />);
    await wait();
    expect(gapWidth()).toBe(240);
    await drag(20);
    expect(width()).toBe(260);
    width.set("20rem");
    await wait();
    expect(gapWidth()).toBe(320);
    expect(handle()).toHaveAttribute("aria-valuenow", "320");
  });

  it("custom class + label", async () => {
    render(() => <App sidebar={{ resizeHandleClass: "my-handle", resizeHandleLabel: "Resize chats" }} />);
    await wait();
    expect(handle()).toHaveClass("my-handle");
    expect(handle()).toHaveAttribute("aria-label", "Resize chats");
  });
});
