// DOM-target suite: `Drawer` (upstream tests/components/drawer/drawer.test.tsx ported to happy-dom): open via the trigger exposes
// the compound slots (`data-slot` drawer-backdrop / -content / -handle / -header / -body / -footer, `drawer__dialog`), heading,
// close; Escape dismiss + `onOpenChange(false)`; Escape blocked with `isKeyboardDismissDisabled`; CloseTrigger with
// `isDismissable={false}`; placement modifier + `data-placement`; controlled `isOpen` (read-only accessor stays open);
// drag-target ownership across stacked drawers. Rivet: classes per variant on every part, `Drawer.Trigger` (cdk Button),
// `useOverlayState` + `state`, controlled Backdrop without a root, `SurfaceContext`, parts outside a Drawer, the drag gesture
// (threshold, dismiss direction, dismiss past 30 %, settle back on the motion loop, body / buttons excluded, not dismissable →
// no drag), `Drawer.Content` fold (= the explicit parts' markup, root `placement`, Header string → Heading). Focus trap / scroll lock /
// focus restore on a real browser: `tests-components/drawer.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal, useContext } = await import("@rivetjs/reactivity");
const { Button } = await import("../src/components/button/index.ts");
const { Drawer, DrawerRoot, DrawerBackdrop, drawerVariants } = await import("../src/components/drawer/index.ts");
const { isDrawerDragTargetOwnedBy, DRAG_THRESHOLD } = await import("../src/components/drawer/drawer.utils.ts");
const { useOverlayState } = await import("../src/hooks/use-overlay-state.tsx");
const { SurfaceContext } = await import("../src/components/surface/index.ts");

type Placement = "top" | "bottom" | "left" | "right";

const flush = () => new Promise((r) => setTimeout(r, 20));
const dialog = () => document.querySelector("[role=dialog]") as HTMLElement | null;
const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`) as HTMLElement | null;
const escape = (target: Element) =>
  target.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );

interface FixtureProps {
  defaultOpen?: boolean;
  isOpen?: () => boolean;
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
}

const DrawerFixture = (props: FixtureProps) => (
  <Drawer defaultOpen={props.defaultOpen} isOpen={props.isOpen} onOpenChange={props.onOpenChange}>
    <Button>Open Drawer</Button>
    <Drawer.Backdrop isDismissable={props.isDismissable} isKeyboardDismissDisabled={props.isKeyboardDismissDisabled}>
      <Drawer.Container placement={props.placement}>
        <Drawer.Dialog>
          <Drawer.Handle />
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Heading>Drawer Title</Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body>
            <p>Drawer body content</p>
            <Button>Inside action</Button>
          </Drawer.Body>
          <Drawer.Footer>
            <Button slot="close">Confirm</Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Container>
    </Drawer.Backdrop>
  </Drawer>
);

test("drawer: index exports", () => {
  assert.equal(Drawer, DrawerRoot);
  assert.equal(Drawer.Root, DrawerRoot);
  assert.equal(Drawer.Backdrop, DrawerBackdrop);
  assert.equal(drawerVariants().dialog(), "drawer__dialog drawer__dialog--bottom");
});

test("drawer (upstream): exposes compound slots; Confirm (slot=close) closes", async () => {
  const r = render(() => <DrawerFixture />);
  assert.equal(dialog(), null);
  r.container.querySelector("button")!.click();
  await flush();
  const d = dialog();
  assert.ok(d);
  assert.equal(d.getAttribute("data-slot"), "drawer-dialog");
  assert.match(d.className, /drawer__dialog/);
  for (const name of ["drawer-backdrop", "drawer-content", "drawer-handle", "drawer-header", "drawer-body", "drawer-footer"]) assert.ok(slot(name), name);
  const h = slot("drawer-heading")!;
  assert.match(h.tagName, /^H[1-6]$/);
  assert.equal(h.textContent, "Drawer Title");
  assert.equal(d.getAttribute("aria-labelledby"), h.id);
  [...d.querySelectorAll("button")].find((b) => b.textContent === "Confirm")!.click();
  await flush();
  await flush();
  assert.equal(dialog(), null);
  r.unmount();
});

test("drawer (upstream): supports Escape dismiss when dismissable", async () => {
  const calls: boolean[] = [];
  const r = render(() => <DrawerFixture defaultOpen onOpenChange={(o) => calls.push(o)} />);
  await flush();
  assert.ok(dialog());
  escape(dialog()!);
  await flush();
  await flush();
  assert.deepEqual(calls, [false]);
  assert.equal(dialog(), null);
  r.unmount();
});

test("drawer (upstream): blocks Escape dismiss when keyboard dismiss is disabled", async () => {
  const calls: boolean[] = [];
  const r = render(() => <DrawerFixture defaultOpen isKeyboardDismissDisabled onOpenChange={(o) => calls.push(o)} />);
  await flush();
  escape(dialog()!);
  await flush();
  assert.ok(dialog());
  assert.deepEqual(calls, []);
  r.unmount();
});

test("drawer (upstream): supports closing via CloseTrigger when outside dismiss is disabled", async () => {
  const calls: boolean[] = [];
  const r = render(() => <DrawerFixture defaultOpen isDismissable={false} onOpenChange={(o) => calls.push(o)} />);
  await flush();
  const close = slot("drawer-close-trigger")!;
  assert.equal(close.getAttribute("aria-label"), "Close");
  close.click();
  await flush();
  await flush();
  assert.deepEqual(calls, [false]);
  assert.equal(dialog(), null);
  r.unmount();
});

test("drawer (upstream): exposes placement content modifier and data-placement", async () => {
  const r = render(() => <DrawerFixture defaultOpen placement="right" />);
  await flush();
  const content = slot("drawer-content")!;
  assert.equal(content.getAttribute("data-placement"), "right");
  assert.match(content.className, /drawer__content--right/);
  assert.equal(dialog()!.getAttribute("data-placement"), "right");
  assert.match(dialog()!.className, /drawer__dialog--right/);
  r.unmount();
});

test("drawer (upstream): supports controlled isOpen (stays open until isOpen changes)", async () => {
  const open = signal(false);
  const calls: boolean[] = [];
  const r = render(() => <DrawerFixture isOpen={() => open()} onOpenChange={(o) => calls.push(o)} />);
  await flush();
  assert.equal(dialog(), null);
  open.set(true);
  await flush();
  assert.ok(dialog());
  escape(dialog()!);
  await flush();
  assert.deepEqual(calls, [false]);
  assert.ok(dialog());
  r.unmount();
});

test("drawer (upstream): supports handle ownership across stacked drawers", async () => {
  const r = render(() => (
    <Drawer defaultOpen>
      <Button>Open parent drawer</Button>
      <Drawer.Backdrop>
        <Drawer.Container>
          <Drawer.Dialog>
            <Drawer.Handle data-testid="parent-drawer-handle" />
            <Drawer.Header>
              <Drawer.Heading>Parent Drawer</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <Drawer defaultOpen>
                <Button>Open child drawer</Button>
                <Drawer.Backdrop>
                  <Drawer.Container>
                    <Drawer.Dialog>
                      <Drawer.Handle data-testid="child-drawer-handle" />
                      <Drawer.Header>
                        <Drawer.Heading>Child Drawer</Drawer.Heading>
                      </Drawer.Header>
                      <Drawer.Body>Child drawer body</Drawer.Body>
                    </Drawer.Dialog>
                  </Drawer.Container>
                </Drawer.Backdrop>
              </Drawer>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Container>
      </Drawer.Backdrop>
    </Drawer>
  ));
  await flush();
  const childHandle = document.querySelector("[data-testid=child-drawer-handle]") as HTMLElement;
  const childDialog = childHandle.closest<HTMLElement>('[data-slot="drawer-dialog"]')!;
  const parentDialog = (document.querySelector("[data-testid=parent-drawer-handle]") as HTMLElement).closest<HTMLElement>('[data-slot="drawer-dialog"]')!;
  assert.ok(childDialog);
  assert.ok(parentDialog);
  assert.notEqual(childDialog, parentDialog);
  assert.equal(isDrawerDragTargetOwnedBy(childHandle, childDialog), true);
  assert.equal(isDrawerDragTargetOwnedBy(childHandle, parentDialog), false);
  r.unmount();
});

test("drawer: default classes (opaque backdrop, bottom placement), handle markup, body touch-action, SurfaceContext", async () => {
  let surface: unknown;
  const Probe = () => {
    surface = useContext(SurfaceContext).variant;
    return null;
  };
  const r = render(() => (
    <Drawer defaultOpen>
      <Button>Open</Button>
      <Drawer.Backdrop>
        <Drawer.Container>
          <Drawer.Dialog>
            <Drawer.Handle />
            <Drawer.Body>
              <Probe />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Container>
      </Drawer.Backdrop>
    </Drawer>
  ));
  await flush();
  assert.match(slot("drawer-backdrop")!.className, /^drawer__backdrop drawer__backdrop--opaque/);
  assert.equal(slot("drawer-content")!.className, "drawer__content drawer__content--bottom");
  assert.equal(slot("drawer-content")!.getAttribute("data-placement"), "bottom");
  assert.equal(dialog()!.className, "drawer__dialog drawer__dialog--bottom");
  assert.equal(dialog()!.getAttribute("data-placement"), "bottom");
  assert.equal(dialog()!.style.touchAction, "none");
  const handle = slot("drawer-handle")!;
  assert.equal(handle.className, "drawer__handle");
  assert.equal(handle.getAttribute("aria-hidden"), "true");
  assert.ok(handle.querySelector(":scope > [data-slot=drawer-handle-bar]"));
  assert.equal(slot("drawer-body")!.style.touchAction, "pan-y");
  assert.equal(surface, "default");
  r.unmount();
});

test("drawer: variant / placement + class on every part; Drawer.Trigger is a cdk Button", async () => {
  const r = render(() => (
    <Drawer>
      <Drawer.Trigger class="tr">Open</Drawer.Trigger>
      <Drawer.Backdrop variant="blur" class="bd">
        <Drawer.Container placement="left" class="ct">
          <Drawer.Dialog class="dl">
            <Drawer.Handle class="hn" />
            <Drawer.CloseTrigger class="cl" />
            <Drawer.Header class="hd">
              <Drawer.Heading class="hg">T</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body class="bo">b</Drawer.Body>
            <Drawer.Footer class="ft">f</Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Container>
      </Drawer.Backdrop>
    </Drawer>
  ));
  const trigger = r.container.querySelector("[data-slot=drawer-trigger]") as HTMLElement;
  assert.equal(trigger.tagName, "BUTTON");
  assert.equal(trigger.className, "drawer__trigger tr");
  trigger.click();
  await flush();
  assert.match(slot("drawer-backdrop")!.className, /^drawer__backdrop drawer__backdrop--blur bd$/);
  assert.equal(slot("drawer-content")!.className, "drawer__content drawer__content--left ct");
  assert.equal(dialog()!.className, "drawer__dialog drawer__dialog--left dl");
  assert.equal(slot("drawer-handle")!.className, "drawer__handle hn");
  assert.equal(slot("drawer-header")!.className, "drawer__header hd");
  assert.equal(slot("drawer-heading")!.className, "drawer__heading hg");
  assert.equal(slot("drawer-body")!.className, "drawer__body bo");
  assert.equal(slot("drawer-footer")!.className, "drawer__footer ft");
  assert.match(slot("drawer-close-trigger")!.className, /drawer__close-trigger cl$/);
  r.unmount();
});

test("drawer: useOverlayState + state prop; controlled Backdrop without a root is styled", async () => {
  let state!: ReturnType<typeof useOverlayState>;
  const r = render(() => {
    state = useOverlayState();
    return (
      <div>
        <Drawer state={state}>
          <Drawer.Backdrop>
            <Drawer.Container>
              <Drawer.Dialog aria-label="State">x</Drawer.Dialog>
            </Drawer.Container>
          </Drawer.Backdrop>
        </Drawer>
      </div>
    );
  });
  state.open();
  await flush();
  assert.ok(dialog());
  escape(dialog()!);
  await flush();
  await flush();
  assert.equal(state.isOpen(), false);
  assert.equal(dialog(), null);
  r.unmount();

  const isOpen = signal(true);
  const r2 = render(() => (
    <Drawer.Backdrop isOpen={isOpen}>
      <Drawer.Container placement="top">
        <Drawer.Dialog aria-label="Standalone">
          <Drawer.Header>h</Drawer.Header>
        </Drawer.Dialog>
      </Drawer.Container>
    </Drawer.Backdrop>
  ));
  await flush();
  assert.equal(dialog()!.className, "drawer__dialog drawer__dialog--top");
  assert.equal(slot("drawer-header")!.className, "drawer__header");
  escape(dialog()!);
  await flush();
  await flush();
  assert.equal(isOpen(), false);
  r2.unmount();
});

test("drawer: parts outside a Drawer get only the caller's class", () => {
  const r = render(() => (
    <div>
      <Drawer.Header class="x">h</Drawer.Header>
      <Drawer.Footer>f</Drawer.Footer>
    </div>
  ));
  assert.equal(r.container.querySelector("[data-slot=drawer-header]")!.className, "x");
  assert.equal(r.container.querySelector("[data-slot=drawer-footer]")!.className, "");
  r.unmount();
});

// ---- drag to dismiss (upstream `useDrawerDrag`) ----
const PointerEventCtor = (window as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent;
const pointer = (target: Element, type: string, init: { x?: number; y?: number; button?: number }) =>
  target.dispatchEvent(
    new PointerEventCtor(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "touch",
      button: init.button ?? 0,
      clientX: init.x ?? 0,
      clientY: init.y ?? 0,
    }),
  );
const sized = (el: HTMLElement, size: number) => {
  Object.defineProperty(el, "offsetHeight", { configurable: true, value: size });
  Object.defineProperty(el, "offsetWidth", { configurable: true, value: size });
};
const until = async (check: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 16));
  return check();
};

test("drawer drag: past 30 % dismisses (onOpenChange false), keeps the dragged transform", async () => {
  const calls: boolean[] = [];
  const r = render(() => <DrawerFixture defaultOpen onOpenChange={(o) => calls.push(o)} />);
  await flush();
  const d = dialog()!;
  sized(d, 400);
  const handle = slot("drawer-handle")!;
  pointer(handle, "pointerdown", { y: 100 });
  pointer(d, "pointermove", { y: 100 + DRAG_THRESHOLD - 1 });
  assert.equal(d.style.transform, "", "below the threshold: no drag");
  await new Promise((r) => setTimeout(r, 30));
  pointer(d, "pointermove", { y: 260 });
  await until(() => d.style.transform !== "");
  assert.match(d.style.transform, /^translateY\(/);
  assert.equal(d.style.transition, "none");
  await new Promise((r) => setTimeout(r, 120));
  pointer(d, "pointerup", { y: 260 });
  assert.equal(d.style.transform, "translateY(160px)");
  await flush();
  assert.deepEqual(calls, [false]);
  r.unmount();
});

test("drawer drag: a short slow drag settles back on the motion loop; only the dismiss direction", async () => {
  const calls: boolean[] = [];
  const r = render(() => <DrawerFixture defaultOpen onOpenChange={(o) => calls.push(o)} />);
  await flush();
  const d = dialog()!;
  sized(d, 400);
  const header = slot("drawer-header")!;
  pointer(header, "pointerdown", { y: 100 });
  pointer(d, "pointermove", { y: 40 });
  await flush();
  assert.equal(d.style.transform, "", "upwards (away from the bottom edge) is clamped to 0");
  // Slow moves (≈ 0.2 px/ms < 0.5): no flick.
  for (let y = 102; y <= 150; y += 2) {
    await new Promise((r) => setTimeout(r, 10));
    pointer(d, "pointermove", { y });
  }
  await until(() => d.style.transform !== "");
  pointer(d, "pointerup", { y: 150 });
  await flush();
  assert.match(d.style.transform, /^translateY\(/, "still settling");
  assert.equal(await until(() => d.style.transform === "" && d.style.transition === ""), true, "settled back");
  assert.deepEqual(calls, []);
  assert.ok(dialog());
  r.unmount();
});

test("drawer drag: never from the body or a button; not dismissable → no drag", async () => {
  const r = render(() => <DrawerFixture defaultOpen />);
  await flush();
  const d = dialog()!;
  sized(d, 400);
  for (const start of [slot("drawer-body")!, slot("drawer-close-trigger")!]) {
    pointer(start, "pointerdown", { y: 100 });
    pointer(d, "pointermove", { y: 300 });
    await flush();
    pointer(d, "pointerup", { y: 300 });
    assert.equal(d.style.transform, "");
  }
  assert.ok(dialog());
  r.unmount();

  const r2 = render(() => <DrawerFixture defaultOpen isDismissable={false} />);
  await flush();
  const d2 = dialog()!;
  sized(d2, 400);
  assert.equal(d2.style.touchAction, "");
  pointer(slot("drawer-handle")!, "pointerdown", { y: 100 });
  pointer(d2, "pointermove", { y: 300 });
  await flush();
  pointer(d2, "pointerup", { y: 300 });
  assert.equal(d2.style.transform, "");
  assert.ok(dialog());
  r2.unmount();
});

// Rivet `Drawer.Content` (identity spec §4.2): Backdrop + Container + Dialog + CloseTrigger folded; placement on the root.
const maskIds = (html: string) => html.replace(/ (id|aria-labelledby|aria-describedby|aria-controls|data-rv-focus-scope)="[^"]*"/g, "");
const openedHtml = async (fixture: () => unknown) => {
  const r = render(fixture as never);
  r.container.querySelector("button")!.click();
  await flush();
  const html = maskIds(slot("drawer-backdrop")?.outerHTML ?? "");
  r.unmount();
  await flush();
  return html;
};

test("drawer: Drawer.Content (root placement) renders the explicit parts' markup; Header string → Heading", async () => {
  const explicit = await openedHtml(() => (
    <Drawer>
      <Button>Open</Button>
      <Drawer.Backdrop variant="blur">
        <Drawer.Container placement="left">
          <Drawer.Dialog class="extra">
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>Menu</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>Body</Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Container>
      </Drawer.Backdrop>
    </Drawer>
  ));
  const folded = await openedHtml(() => (
    <Drawer placement="left">
      <Button>Open</Button>
      <Drawer.Content backdrop="blur" class="extra">
        <Drawer.Header>Menu</Drawer.Header>
        <Drawer.Body>Body</Drawer.Body>
      </Drawer.Content>
    </Drawer>
  ));
  assert.ok(explicit.includes("drawer__content--left") && explicit.includes('data-placement="left"'), explicit);
  assert.equal(folded, explicit);
});

test("drawer: Drawer.Content placement prop wins over the root; closeButton={false}; overlay props; heading labels the dialog", async () => {
  const open = signal(false);
  const r = render(() => (
    <Drawer placement="left">
      <Drawer.Content isOpen={open} placement="top" closeButton={false} isDismissable={false}>
        <Drawer.Header>Filters</Drawer.Header>
        <Drawer.Footer>
          <Button slot="close">Done</Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  ));
  open.set(true);
  await flush();
  const d = dialog();
  assert.ok(d);
  assert.equal(d.getAttribute("data-placement"), "top");
  assert.equal(slot("drawer-close-trigger") === null, true);
  const h = d.querySelector("[data-slot=drawer-heading]") as HTMLElement;
  assert.equal(h?.textContent, "Filters");
  assert.equal(d.getAttribute("aria-labelledby"), h.id);
  assert.equal(d.style.touchAction, "", "isDismissable={false} reaches the dialog (no drag)");
  [...d.querySelectorAll("button")].find((b) => b.textContent === "Done")!.click();
  await flush();
  await flush();
  assert.equal(open(), false);
  r.unmount();
});
