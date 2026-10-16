// Item morph (`@rivetjs/cdk/morph/item`, Rivet-authored): a ListBox option lifts into a panel on the overlay layer.
// Chromium (cdk-browser): long press timing / cancel on move / no selection, keyboard trigger, focus restore,
// interruption, reduced motion, scroll container clipping, RTL, other triggers.
import { afterEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { fireEvent, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { ListBox, ListBoxItem, type ListBoxProps } from "../listbox/index.tsx";
import { ItemMorphPanel, closeItemMorph, createItemMorph, itemMorphProps, type ItemMorphOptions } from "../morph/item.tsx";
import type { Key } from "../collections/types.ts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frames = (n = 2) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(n);
  });
const surface = () => document.querySelector<HTMLElement>("[data-morph-surface]");
const settled = async (open: boolean) => {
  for (let i = 0; i < 120; i++) {
    const s = surface();
    if (open ? s?.hasAttribute("data-open") && !s.hasAttribute("data-morphing") : !s) return;
    await frames(1);
  }
  throw new Error(`morph did not settle ${open ? "open" : "closed"}`);
};

const ANIMALS = ["cat", "dog", "kangaroo", "panda", "snake", "koala", "lemur", "otter"];

function Fixture(p: { options?: ItemMorphOptions; list?: Partial<ListBoxProps>; label?: string }) {
  const morph = createItemMorph(p.options);
  return (
    <div>
      <ListBox aria-label="Animals" {...(p.list ?? {})}>
        {ANIMALS.map((id) => (
          <ListBoxItem id={id} textValue={id} {...itemMorphProps(morph)}>
            {id}
          </ListBoxItem>
        ))}
      </ListBox>
      <ItemMorphPanel morph={morph} aria-label={p.label}>
        {(key: () => Key | null) => (
          <div style={{ width: "280px", height: "200px" }}>
            <h2 id="panel-title">Preview {String(key())}</h2>
            <button type="button" id="panel-action" onClick={() => closeItemMorph(morph)}>
              Done
            </button>
          </div>
        )}
      </ItemMorphPanel>
    </div>
  );
}

const option = (name: string) => within(document.body).getByRole("option", { name });
const down = (el: Element, init: PointerEventInit = {}) =>
  fireEvent.pointerDown(el, { pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, isPrimary: true, clientX: 20, clientY: 10, ...init });
const up = (el: Element, init: PointerEventInit = {}) => fireEvent.pointerUp(el, { pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true, ...init });

async function longPress(el: HTMLElement, ms = 620, pointerType = "mouse") {
  el.focus();
  down(el, { pointerType });
  await wait(ms);
  up(el, { pointerType });
  fireEvent.click(el, { detail: 1 });
}

describe("item morph (ListBox)", () => {
  it("long press opens after the threshold (not before), never selects, labels + focuses the panel", async () => {
    render(() => <Fixture list={{ selectionMode: "single" }} />);
    const dog = option("dog");
    expect(dog).toHaveAttribute("data-rv-long-press");
    dog.focus();
    down(dog);
    await wait(250);
    expect(surface()?.hasAttribute("data-open") ?? false).toBe(false);
    // Primed: the panel content is rendered (hidden) before the threshold.
    expect(surface()).not.toBeNull();
    expect(surface()!.style.visibility).toBe("hidden");
    expect(dog).toHaveAttribute("data-morph-holding");
    expect(parseFloat(dog.style.getPropertyValue("--morph-hold"))).toBeGreaterThan(0);
    await wait(370);
    expect(surface()).toHaveAttribute("data-open");
    expect(dog).not.toHaveAttribute("data-morph-holding");
    up(dog);
    fireEvent.click(dog, { detail: 1 });
    await settled(true);
    expect(dog).toHaveAttribute("aria-selected", "false");
    const dialog = within(document.body).getByRole("dialog");
    expect(dialog).toBe(surface());
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", dog.id);
    expect(dialog.textContent).toContain("Preview dog");
    expect(document.activeElement).toBe(document.getElementById("panel-action"));
    // Background inert while open, the surface is outside the list (overlay layer).
    expect(dog.closest("[inert]")).not.toBeNull();
    expect(dialog.closest("[data-rivet-portal]")?.parentElement).toBe(document.body);
  });

  it("a short press selects and opens nothing; moving the pointer cancels a hold", async () => {
    render(() => <Fixture list={{ selectionMode: "single" }} />);
    const cat = option("cat");
    await userEvent.click(cat);
    expect(cat).toHaveAttribute("aria-selected", "true");
    await wait(80);
    expect(surface()).toBeNull();
    const dog = option("dog");
    down(dog);
    await wait(200);
    fireEvent.pointerMove(dog, { pointerId: 1, pointerType: "mouse", clientX: 60, clientY: 10 });
    await wait(450);
    expect(surface()).toBeNull();
    expect(dog).not.toHaveAttribute("data-morph-holding");
    up(dog);
  });

  it("touch long press does not select, the native context menu is suppressed", async () => {
    render(() => <Fixture list={{ selectionMode: "multiple" }} />);
    const koala = option("koala");
    koala.focus();
    down(koala, { pointerType: "touch" });
    await wait(620);
    const menu = fireEvent.contextMenu(koala);
    expect(menu).toBe(false);
    up(koala, { pointerType: "touch" });
    fireEvent.click(koala, { detail: 1 });
    await settled(true);
    expect(koala).toHaveAttribute("aria-selected", "false");
  });

  it("keyboard: Shift+F10 / ContextMenu open, Escape closes and returns focus, arrows keep navigating", async () => {
    render(() => <Fixture />);
    const cat = option("cat");
    cat.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await settled(true);
    expect(surface()!.textContent).toContain("Preview cat");
    await userEvent.keyboard("{Escape}");
    await settled(false);
    expect(document.activeElement).toBe(cat);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(option("dog"));
    fireEvent.keyDown(document.activeElement!, { key: "ContextMenu" });
    await settled(true);
    expect(surface()!.textContent).toContain("Preview dog");
    // Close from inside the panel: focus back to the item.
    await userEvent.click(document.getElementById("panel-action")!);
    await settled(false);
    expect(document.activeElement).toBe(option("dog"));
  });

  it("a press on the backdrop closes and restores focus", async () => {
    render(() => <Fixture />);
    const panda = option("panda");
    panda.focus();
    fireEvent.keyDown(panda, { key: "F10", shiftKey: true });
    await settled(true);
    fireEvent.pointerDown(document.querySelector("[data-morph-backdrop]")!, { pointerId: 2 });
    await settled(false);
    expect(document.activeElement).toBe(panda);
    expect(panda.closest("[inert]")).toBeNull();
  });

  it("morphs continuously from the row box to the panel box, and is interruptible", async () => {
    render(() => (
      <div style={{ width: "180px" }}>
        <Fixture />
      </div>
    ));
    const lemur = option("lemur");
    const row = lemur.getBoundingClientRect();
    lemur.focus();
    fireEvent.keyDown(lemur, { key: "ContextMenu" });
    await frames(1);
    const s = surface()!;
    expect(s).toHaveAttribute("data-morphing");
    const widths: number[] = [];
    for (let i = 0; i < 6; i++) {
      widths.push(s.getBoundingClientRect().width);
      await frames(1);
    }
    expect(widths[0]).toBeLessThan(260);
    expect(widths[0]).toBeGreaterThanOrEqual(row.width * 0.9);
    expect(Math.max(...widths)).toBeGreaterThan(widths[0]!);
    // Escape mid-morph reverses from where it is (no jump back to the row).
    const before = s.getBoundingClientRect().width;
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await frames(1);
    const after = s.isConnected ? s.getBoundingClientRect().width : 0;
    expect(Math.abs(after - before)).toBeLessThan(60);
    await settled(false);
    expect(document.activeElement).toBe(lemur);
  });

  it("closing from rest starts at the open panel box and shrinks continuously into the row", async () => {
    render(() => <Fixture />);
    const lemur = option("lemur");
    lemur.focus();
    fireEvent.keyDown(lemur, { key: "ContextMenu" });
    await settled(true);
    const s = surface()!;
    const open = s.getBoundingClientRect();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await frames(1);
    const first = s.getBoundingClientRect();
    expect(Math.abs(first.width - open.width)).toBeLessThan(open.width * 0.25);
    expect(Math.abs(first.height - open.height)).toBeLessThan(open.height * 0.25);
    const heights: number[] = [];
    while (s.isConnected && heights.length < 60) {
      heights.push(s.getBoundingClientRect().height);
      await frames(1);
    }
    const row = lemur.getBoundingClientRect();
    expect(heights.filter((h) => h > row.height + 2 && h < open.height - 2).length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...heights)).toBeGreaterThan(row.height * 0.8);
  });

  it("reduced motion jumps (open at once, no inline geometry left)", async () => {
    const real = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((q: string) =>
      q.includes("prefers-reduced-motion")
        ? ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
        : real(q),
    );
    render(() => <Fixture />);
    const otter = option("otter");
    otter.focus();
    fireEvent.keyDown(otter, { key: "ContextMenu" });
    await settled(true);
    const s = surface()!;
    // Jumped: no frame in between, no inline size left.
    expect(s.style.width).toBe("");
    expect(s.style.height).toBe("");
    // No hold feedback either.
    down(option("cat"));
    await wait(150);
    expect(option("cat")).not.toHaveAttribute("data-morph-holding");
    up(option("cat"));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await frames(1);
    expect(surface()).toBeNull();
  });

  it("lifts out of a clipping scroll container", async () => {
    render(() => (
      <div id="scroller" style={{ height: "90px", overflow: "auto" }}>
        <Fixture />
      </div>
    ));
    const scroller = document.getElementById("scroller")!;
    scroller.scrollTop = 60;
    const snake = option("snake");
    snake.focus({ preventScroll: true });
    fireEvent.keyDown(snake, { key: "ContextMenu" });
    await settled(true);
    const box = surface()!.getBoundingClientRect();
    const clip = scroller.getBoundingClientRect();
    expect(box.height).toBeGreaterThan(clip.height);
    // Not clipped: the topmost element at the panel's centre is inside the panel.
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height - 10);
    expect(surface()!.contains(hit)).toBe(true);
    expect(box.left).toBeGreaterThanOrEqual(15);
    expect(box.right).toBeLessThanOrEqual(document.documentElement.clientWidth - 15);
  });

  it("RTL: the panel stays centred on the row inside the viewport", async () => {
    render(() => (
      <div dir="rtl" style={{ width: "100%" }}>
        <Fixture />
      </div>
    ));
    const cat = option("cat");
    cat.focus();
    fireEvent.keyDown(cat, { key: "ContextMenu" });
    await settled(true);
    const row = cat.getBoundingClientRect();
    const box = surface()!.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    expect(box.left).toBeGreaterThanOrEqual(15);
    expect(box.right).toBeLessThanOrEqual(vw - 15);
    const centred = Math.min(Math.max(16, row.left + row.width / 2 - box.width / 2), vw - 16 - box.width);
    expect(Math.abs(box.left - centred)).toBeLessThan(2);
  });

  it("triggers: contextMenu (right click), doubleClick, press (action), none + controlled openKey", async () => {
    render(() => <Fixture options={{ trigger: "contextMenu" }} />);
    const cat = option("cat");
    expect(fireEvent.contextMenu(cat)).toBe(false);
    await settled(true);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await settled(false);
    cleanup();

    render(() => <Fixture options={{ trigger: "doubleClick" }} list={{ selectionMode: "none" }} />);
    await userEvent.dblClick(option("dog"));
    await settled(true);
    expect(surface()!.textContent).toContain("Preview dog");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await settled(false);
    cleanup();

    render(() => <Fixture options={{ trigger: "press" }} />);
    await userEvent.click(option("panda"));
    await settled(true);
    expect(surface()!.textContent).toContain("Preview panda");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await settled(false);
    cleanup();

    const openKey = signal<Key | null>(null);
    const changes: (Key | null)[] = [];
    render(() => <Fixture options={{ trigger: "none", openKey, onOpenChange: (k) => changes.push(k) }} />);
    fireEvent.keyDown(option("cat"), { key: "ContextMenu" });
    down(option("cat"));
    await wait(600);
    up(option("cat"));
    expect(surface()?.hasAttribute("data-open") ?? false).toBe(false);
    openKey.set("koala");
    await settled(true);
    expect(surface()!.textContent).toContain("Preview koala");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await settled(false);
    expect(openKey()).toBe(null);
    expect(changes).toEqual([null]);
  });

  it("aria-label names the panel instead of the item", async () => {
    render(() => <Fixture label="Animal preview" />);
    fireEvent.keyDown(option("cat"), { key: "ContextMenu" });
    await settled(true);
    expect(surface()).toHaveAttribute("aria-label", "Animal preview");
    expect(surface()).not.toHaveAttribute("aria-labelledby");
  });
});
