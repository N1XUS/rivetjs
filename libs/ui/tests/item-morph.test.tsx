// DOM-target suite (happy-dom): `ItemMorph` (Rivet addition, no HeroUI counterpart; behaviour `@rivetjs/cdk/morph/item`).
// Exports + variants; Shift+F10 on a ui ListBox item opens the panel (slot classes, dialog named by the item, render-function
// child gets the key, `useItemMorphPanel`), `ItemMorph.Close` closes it + focus back to the item, Escape closes, the controlled
// `openKey` Signal follows, `hideBackdrop` / `backdrop` variants. Motion jumps here (happy-dom: `matchMedia` reduce stub);
// long press, motion and frames are covered in Chromium (`libs/cdk/tests/item-morph.browser.test.tsx`,
// `tests-components/item-morph.test.ts`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
(window as unknown as { matchMedia: (q: string) => { matches: boolean } }).matchMedia = (q: string) => ({ matches: q.includes("reduce") }) as never;
(globalThis as unknown as { matchMedia: unknown }).matchMedia = (window as unknown as { matchMedia: unknown }).matchMedia;

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { ListBox } = await import("../src/components/list-box/index.ts");
const mod = await import("../src/components/item-morph/index.ts");
const { ItemMorph, ItemMorphRoot, ItemMorphClose, itemMorphProps, itemMorphVariants, useItemMorph, useItemMorphPanel, ITEM_MORPH_THRESHOLD } = mod;

const flush = () => new Promise((r) => setTimeout(r, 40));
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const key = (target: Element, k: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }),
  );

test("item-morph: exports + variants", () => {
  assert.equal(ItemMorph, ItemMorphRoot);
  assert.equal(ItemMorph.Root, ItemMorphRoot);
  assert.equal(ItemMorph.Close, ItemMorphClose);
  assert.equal(ITEM_MORPH_THRESHOLD, 500);
  const s = itemMorphVariants();
  assert.equal(s.base(), "item-morph");
  assert.equal(s.panel(), "item-morph__panel");
  assert.equal(s.backdrop(), "item-morph__backdrop item-morph__backdrop--blur");
  assert.equal(itemMorphVariants({ backdrop: "opaque" }).backdrop(), "item-morph__backdrop item-morph__backdrop--opaque");
  assert.equal(s.close(), "item-morph__close");
});

const Contacts = (props: { openKey?: ReturnType<typeof signal<string | null>>; changes?: unknown[]; backdrop?: "opaque"; hideBackdrop?: boolean }) => {
  const m = useItemMorph({ openKey: props.openKey as never, onOpenChange: (k) => props.changes?.push(k) });
  const Body = () => {
    const panel = useItemMorphPanel();
    return <p id="panel-key">{() => String(panel.key())}</p>;
  };
  return (
    <>
      <ListBox aria-label="Contacts" selectionMode="single">
        <ListBox.Item id="ada" textValue="Ada" {...itemMorphProps(m)}>
          Ada
        </ListBox.Item>
        <ListBox.Item id="bob" textValue="Bob" {...itemMorphProps(m)}>
          Bob
        </ListBox.Item>
      </ListBox>
      <ItemMorph morph={m} backdrop={props.backdrop} hideBackdrop={props.hideBackdrop} panelClass="w-72">
        {(k) => (
          <>
            <h2 id="panel-title">{() => `Contact ${k()}`}</h2>
            <Body />
            <ItemMorph.Close id="panel-done">Done</ItemMorph.Close>
          </>
        )}
      </ItemMorph>
    </>
  );
};

test("item-morph: Shift+F10 opens a ListBox item's panel, Close + Escape return focus", async () => {
  const changes: unknown[] = [];
  const r = render(() => <Contacts changes={changes} />);
  const ada = q('[role=option][data-key="ada"]')!;
  assert.equal(ada.hasAttribute("data-rv-morph"), true);
  assert.equal(ada.hasAttribute("data-rv-long-press"), true);
  assert.equal(q("[data-morph-surface]"), null, "nothing renders before a trigger");
  ada.focus();
  key(ada, "F10", { shiftKey: true });
  await flush();
  const surface = q("[data-morph-surface]")!;
  assert.ok(surface, "panel rendered");
  assert.equal(surface.getAttribute("role"), "dialog");
  assert.equal(surface.className, "item-morph");
  assert.equal(surface.getAttribute("aria-labelledby"), ada.id);
  assert.equal(q("[data-morph-expanded]")!.className, "item-morph__panel w-72");
  assert.equal(q("[data-morph-backdrop]")!.className, "item-morph__backdrop item-morph__backdrop--blur");
  assert.equal(q("#panel-title")!.textContent, "Contact ada");
  assert.equal(q("#panel-key")!.textContent, "ada");
  assert.match(q("#panel-done")!.className, /item-morph__close/);
  assert.equal(q("#panel-done")!.getAttribute("data-slot"), "item-morph-close");
  assert.equal(ada.getAttribute("aria-selected"), "false", "opening never selects");
  assert.deepEqual(changes, ["ada"]);
  q("#panel-done")!.click();
  await flush();
  assert.equal(q("[data-morph-surface]"), null);
  assert.equal(document.activeElement, ada);
  assert.deepEqual(changes, ["ada", null]);
  const bob = q('[role=option][data-key="bob"]')!;
  bob.focus();
  key(bob, "ContextMenu");
  await flush();
  assert.equal(q("#panel-title")!.textContent, "Contact bob");
  key(document.activeElement ?? document.body, "Escape");
  await flush();
  assert.equal(q("[data-morph-surface]"), null);
  assert.equal(document.activeElement, bob);
  r.unmount();
});

test("item-morph: controlled openKey Signal + backdrop variants", async () => {
  const openKey = signal<string | null>(null);
  const r = render(() => <Contacts openKey={openKey} backdrop="opaque" />);
  openKey.set("bob");
  await flush();
  assert.equal(q("#panel-title")!.textContent, "Contact bob");
  assert.equal(q("[data-morph-backdrop]")!.className, "item-morph__backdrop item-morph__backdrop--opaque");
  q("#panel-done")!.click();
  await flush();
  assert.equal(openKey(), null);
  assert.equal(q("[data-morph-surface]"), null);
  r.unmount();
  const r2 = render(() => <Contacts hideBackdrop />);
  const ada = q('[role=option][data-key="ada"]')!;
  ada.focus();
  key(ada, "F10", { shiftKey: true });
  await flush();
  assert.ok(q("[data-morph-surface]"));
  assert.equal(q("[data-morph-backdrop]"), null);
  r2.unmount();
});
