// DOM-target suite (happy-dom): `Sheet` (Rivet-authored; feature set inspired by HeroUI Pro's public Sheet docs). Compound
// slots + classes per placement / detached / backdrop variant, Escape + backdrop dismiss, `isDismissable={false}` (Escape
// ignored, CloseTrigger / Close close), `onClose`, controlled `isOpen` / `state`, `SurfaceContext`, parts outside a Sheet,
// snap points (first-render transform expression, backdrop variable, handle press cycles + closes past the last, controlled
// `activeSnapPoint` signal, uncontrolled reset after close), `isModal={false}` (no backdrop, no inert outside, Escape),
// nested sheets (`data-sheet-nested-open` on the parent), `shouldScaleBackground`. Gestures on a real browser:
// `tests-components/sheet.test.ts` + cdk `sheet-motion.browser.test.tsx`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal, useContext } = await import("@rivetjs/reactivity");
const { Button } = await import("../src/components/button/index.ts");
const { Sheet, SheetRoot, SheetBackdrop, sheetVariants } = await import("../src/components/sheet/index.ts");
const { useOverlayState } = await import("../src/hooks/use-overlay-state.tsx");
const { SurfaceContext } = await import("../src/components/surface/index.ts");

type Placement = "top" | "bottom" | "left" | "right";
type Snap = number | string;

const flush = () => new Promise((r) => setTimeout(r, 20));
const settle = async () => {
  for (let i = 0; i < 4; i++) await flush();
};
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
  isDetached?: boolean;
  isModal?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  placement?: Placement;
  snapPoints?: Snap[];
  activeSnapPoint?: ReturnType<typeof signal<Snap | null>>;
  variant?: "opaque" | "blur" | "transparent";
}

const SheetFixture = (props: FixtureProps) => (
  <Sheet
    defaultOpen={props.defaultOpen}
    isOpen={props.isOpen}
    isDismissable={props.isDismissable}
    isDetached={props.isDetached}
    isModal={props.isModal}
    onOpenChange={props.onOpenChange}
    onClose={props.onClose}
    placement={props.placement}
    snapPoints={props.snapPoints}
    activeSnapPoint={props.activeSnapPoint}
  >
    <Sheet.Trigger>Open sheet</Sheet.Trigger>
    <Sheet.Backdrop variant={props.variant}>
      <Sheet.Content>
        <Sheet.Dialog>
          <Sheet.Handle />
          <Sheet.CloseTrigger />
          <Sheet.Header>
            <Sheet.Heading>Sheet title</Sheet.Heading>
          </Sheet.Header>
          <Sheet.Body>
            <p>Body</p>
          </Sheet.Body>
          <Sheet.Footer>
            <Sheet.Close>Done</Sheet.Close>
          </Sheet.Footer>
        </Sheet.Dialog>
      </Sheet.Content>
    </Sheet.Backdrop>
  </Sheet>
);

test("sheet: index exports + variants", () => {
  assert.equal(Sheet, SheetRoot);
  assert.equal(Sheet.Root, SheetRoot);
  assert.equal(Sheet.Backdrop, SheetBackdrop);
  assert.equal(sheetVariants().dialog(), "sheet__dialog sheet__dialog--bottom");
  assert.equal(sheetVariants().backdrop(), "sheet__backdrop sheet__backdrop--opaque");
  assert.equal(sheetVariants({ isDetached: true, placement: "left" }).content(), "sheet__content sheet__content--detached sheet__content--left");
});

test("sheet: trigger opens; compound slots, classes, data attributes; Close closes", async () => {
  const r = render(() => <SheetFixture />);
  assert.equal(dialog(), null);
  const trigger = r.container.querySelector("[data-slot=sheet-trigger]") as HTMLElement;
  assert.equal(trigger.className, "sheet__trigger");
  trigger.click();
  await flush();
  const d = dialog()!;
  assert.ok(d);
  assert.equal(d.getAttribute("data-slot"), "sheet-dialog");
  assert.equal(d.className, "sheet__dialog sheet__dialog--bottom");
  assert.equal(d.getAttribute("data-placement"), "bottom");
  assert.equal(d.getAttribute("data-sheet-drawer"), "");
  assert.ok(d.getAttribute("data-sheet-id"));
  assert.equal(d.hasAttribute("data-sheet-snap-points"), false);
  assert.match(slot("sheet-backdrop")!.className, /^sheet__backdrop sheet__backdrop--opaque/);
  assert.equal(slot("sheet-content")!.className, "sheet__content sheet__content--bottom");
  assert.equal(slot("sheet-handle")!.getAttribute("aria-hidden"), "true");
  assert.ok(slot("sheet-handle")!.querySelector(":scope > [data-slot=sheet-handle-bar]"));
  for (const name of ["sheet-header", "sheet-body", "sheet-footer", "sheet-close-trigger"]) assert.ok(slot(name), name);
  const h = slot("sheet-heading")!;
  assert.equal(h.className, "sheet__heading");
  assert.equal(d.getAttribute("aria-labelledby"), h.id);
  assert.equal(d.style.touchAction, "none", "the gesture is attached (inline touch-action)");
  const close = slot("sheet-close")!;
  assert.equal(close.className, "sheet__close");
  close.click();
  await settle();
  assert.equal(dialog(), null);
  r.unmount();
});

test("sheet: Escape dismisses + onOpenChange / onClose; not dismissable ignores Escape, CloseTrigger closes", async () => {
  const calls: unknown[] = [];
  const r = render(() => <SheetFixture defaultOpen onOpenChange={(o) => calls.push(o)} onClose={() => calls.push("close")} />);
  await flush();
  escape(dialog()!);
  await settle();
  assert.deepEqual(calls, [false, "close"]);
  assert.equal(dialog(), null);
  r.unmount();

  const calls2: boolean[] = [];
  const r2 = render(() => <SheetFixture defaultOpen isDismissable={false} onOpenChange={(o) => calls2.push(o)} />);
  await flush();
  escape(dialog()!);
  await flush();
  assert.ok(dialog());
  assert.equal(dialog()!.style.touchAction, "none");
  slot("sheet-close-trigger")!.click();
  await settle();
  assert.deepEqual(calls2, [false]);
  assert.equal(dialog(), null);
  r2.unmount();
});

test("sheet: placement / detached / backdrop variant classes; class on every part", async () => {
  const r = render(() => (
    <Sheet defaultOpen placement="right" isDetached>
      <Sheet.Trigger class="tr">Open</Sheet.Trigger>
      <Sheet.Backdrop variant="blur" class="bd">
        <Sheet.Content class="ct">
          <Sheet.Dialog class="dl">
            <Sheet.Handle class="hn" />
            <Sheet.Header class="hd">
              <Sheet.Heading class="hg">T</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body class="bo">b</Sheet.Body>
            <Sheet.Footer class="ft">f</Sheet.Footer>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  ));
  await flush();
  assert.equal(r.container.querySelector("[data-slot=sheet-trigger]")!.className, "sheet__trigger tr");
  assert.match(slot("sheet-backdrop")!.className, /^sheet__backdrop sheet__backdrop--blur bd$/);
  assert.equal(slot("sheet-content")!.className, "sheet__content sheet__content--detached sheet__content--right ct");
  assert.equal(slot("sheet-content")!.getAttribute("data-sheet-detached"), "true");
  assert.equal(dialog()!.className, "sheet__dialog sheet__dialog--detached sheet__dialog--right dl");
  assert.equal(dialog()!.getAttribute("data-sheet-detached"), "true");
  assert.equal(dialog()!.style.touchAction, "pan-y", "horizontal sheet: vertical panning stays native");
  assert.equal(slot("sheet-handle")!.className, "sheet__handle hn");
  assert.equal(slot("sheet-header")!.className, "sheet__header hd");
  assert.equal(slot("sheet-body")!.className, "sheet__body bo");
  assert.equal(slot("sheet-footer")!.className, "sheet__footer ft");
  r.unmount();
});

test("sheet: useOverlayState + state; controlled isOpen accessor stays open; SurfaceContext; parts outside", async () => {
  let state!: ReturnType<typeof useOverlayState>;
  let surface: unknown;
  const Probe = () => {
    surface = useContext(SurfaceContext).variant;
    return null;
  };
  const r = render(() => {
    state = useOverlayState();
    return (
      <Sheet state={state}>
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog aria-label="State">
              <Probe />
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
    );
  });
  state.open();
  await flush();
  assert.ok(dialog());
  assert.equal(surface, "default");
  escape(dialog()!);
  await settle();
  assert.equal(state.isOpen(), false);
  assert.equal(dialog(), null);
  r.unmount();

  const open = signal(true);
  const calls: boolean[] = [];
  const r2 = render(() => <SheetFixture isOpen={() => open()} onOpenChange={(o) => calls.push(o)} />);
  await flush();
  escape(dialog()!);
  await flush();
  assert.deepEqual(calls, [false]);
  assert.ok(dialog(), "read-only accessor: stays open");
  r2.unmount();

  const r3 = render(() => (
    <div>
      <Sheet.Header class="x">h</Sheet.Header>
      <Sheet.Footer>f</Sheet.Footer>
    </div>
  ));
  assert.equal(r3.container.querySelector("[data-slot=sheet-header]")!.className, "x");
  assert.equal(r3.container.querySelector("[data-slot=sheet-footer]")!.className, "");
  r3.unmount();
});

test("sheet snap points: first-render transform, backdrop variable, handle press cycles then closes", async () => {
  const changes: unknown[] = [];
  const r = render(() => (
    <Sheet defaultOpen snapPoints={[0.4, 1]} onActiveSnapPointChange={(p) => changes.push(p)}>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog aria-label="Snap">
            <Sheet.Handle />
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  ));
  await flush();
  const d = dialog()!;
  assert.equal(d.getAttribute("data-sheet-snap-points"), "true");
  assert.equal(slot("sheet-backdrop")!.getAttribute("data-sheet-snap-points"), "true");
  // happy-dom measures 0: the motion rests at 0 px once attached; the first render used the CSS expression.
  assert.match(d.style.transform, /^translateY\(/);
  assert.equal(slot("sheet-backdrop")!.style.getPropertyValue("--sheet-backdrop-opacity") !== "", true);
  slot("sheet-handle")!.click();
  await flush();
  assert.deepEqual(changes, [1]);
  slot("sheet-handle")!.click();
  await settle();
  assert.equal(dialog(), null, "past the last point: closes");
  r.unmount();
});

test("sheet snap points: SSR-free first render uses snapPointTransform; controlled activeSnapPoint signal; uncontrolled reset", async () => {
  const active = signal<Snap | null>("148px");
  const r = render(() => <SheetFixture defaultOpen snapPoints={["148px", 1]} activeSnapPoint={active} />);
  await flush();
  slot("sheet-handle")!.click();
  await flush();
  assert.equal(active(), 1, "two-way signal written");
  active.set("148px");
  await flush();
  assert.ok(dialog());
  r.unmount();

  const changes: unknown[] = [];
  const r2 = render(() => (
    <Sheet snapPoints={[0.3, 0.6, 1]} onActiveSnapPointChange={(p) => changes.push(p)}>
      <Sheet.Trigger>Open</Sheet.Trigger>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog aria-label="Reset">
            <Sheet.Handle />
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  ));
  const trigger = r2.container.querySelector("[data-slot=sheet-trigger]") as HTMLElement;
  trigger.click();
  await flush();
  assert.equal(dialog()!.style.transform !== "", true);
  slot("sheet-handle")!.click();
  await flush();
  escape(dialog()!);
  await settle();
  assert.deepEqual(changes, [0.6, 0.3], "closing resets an uncontrolled point to the default");
  r2.unmount();
});

test("sheet isModal={false}: no backdrop, outside stays interactive, Escape closes", async () => {
  const r = render(() => (
    <div>
      <button id="outside">Outside</button>
      <SheetFixture defaultOpen isModal={false} />
    </div>
  ));
  await flush();
  assert.equal(slot("sheet-backdrop"), null);
  const content = slot("sheet-content")!;
  assert.equal(content.getAttribute("data-sheet-modal"), "false");
  assert.equal(content.className, "sheet__content sheet__content--bottom");
  const outside = document.getElementById("outside")!;
  assert.equal(outside.closest("[inert]"), null);
  assert.equal(outside.closest("[aria-hidden=true]"), null);
  escape(dialog()!);
  await settle();
  assert.equal(dialog(), null);
  r.unmount();
});

test("sheet: nested sheet marks the parent; shouldScaleBackground marks the wrapper", async () => {
  const r = render(() => (
    <div data-sheet-wrapper="">
      <Sheet defaultOpen shouldScaleBackground>
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog aria-label="Parent">
              <Sheet.NestedRoot defaultOpen>
                <Sheet.Backdrop>
                  <Sheet.Content>
                    <Sheet.Dialog aria-label="Child">child</Sheet.Dialog>
                  </Sheet.Content>
                </Sheet.Backdrop>
              </Sheet.NestedRoot>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
    </div>
  ));
  await flush();
  const parent = document.querySelector("[aria-label=Parent]") as HTMLElement;
  const child = document.querySelector("[aria-label=Child]") as HTMLElement;
  assert.ok(parent && child);
  assert.equal(parent.getAttribute("data-sheet-nested-open"), "true");
  assert.equal(r.container.querySelector("[data-sheet-wrapper]")!.getAttribute("data-sheet-scaled"), "true");
  escape(child);
  await settle();
  assert.equal(document.querySelector("[aria-label=Child]"), null);
  assert.equal(parent.hasAttribute("data-sheet-nested-open"), false);
  r.unmount();
});
