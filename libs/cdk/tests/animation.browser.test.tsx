// createEnterAnimation / createExitAnimation (react-aria utils/animation port) in Chromium: real CSS
// animations, promise-returning callbacks, interruption by reopening; a portaled ModalOverlay's transition backdrop.
import { afterEach, expect, onTestFinished, test, vi } from "vitest";
import { signal, _setRegionStateHook } from "@rivetjs/reactivity";
import { Show, ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { createEnterAnimation, createExitAnimation } from "../utils/animation.tsx";
import { Dialog } from "../dialog/index.tsx";
import { Modal, ModalOverlay } from "../modal/index.tsx";

afterEach(cleanup);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function Box(props: {
  open: () => boolean;
  onEnter?: (el: HTMLElement) => void | Promise<void>;
  onExit?: (el: HTMLElement) => void | Promise<void>;
  style?: Record<string, string>;
}) {
  const el = ref<HTMLDivElement>();
  const entering = createEnterAnimation(el, true, props.onEnter);
  const exiting = createExitAnimation(el, props.open, props.onExit);
  return (
    <Show when={() => props.open() || exiting()}>
      {() => (
        <div ref={el} id="box" style={props.style} data-entering={entering() ? "true" : undefined} data-exiting={exiting() ? "true" : undefined}>
          box
        </div>
      )}
    </Show>
  );
}

test("synchronous onEnter completes the entry at once; onExit unmounts at once", async () => {
  const open = signal(true);
  const onEnter = vi.fn();
  const onExit = vi.fn();
  render(() => <Box open={open} onEnter={onEnter} onExit={onExit} />);
  const box = document.getElementById("box")!;
  expect(box.getAttribute("data-entering")).toBe("true");
  await flush();
  expect(onEnter).toHaveBeenCalledWith(box);
  expect(box.hasAttribute("data-entering")).toBe(false);
  open.set(false);
  await flush();
  expect(onExit).toHaveBeenCalledWith(box);
  expect(document.getElementById("box")).toBeNull();
});

test("stays entering / mounted until the returned promise resolves", async () => {
  const open = signal(true);
  const enter = deferred(),
    exit = deferred();
  render(() => <Box open={open} onEnter={() => enter.promise} onExit={() => exit.promise} />);
  const box = document.getElementById("box")!;
  await flush();
  expect(box.getAttribute("data-entering")).toBe("true");
  enter.resolve();
  await flush();
  expect(box.hasAttribute("data-entering")).toBe(false);
  open.set(false);
  await flush();
  expect(box.isConnected).toBe(true);
  expect(box.getAttribute("data-exiting")).toBe("true");
  exit.resolve();
  await flush();
  expect(box.isConnected).toBe(false);
});

test("waits for running CSS animations", async () => {
  const open = signal(true);
  const style = document.head.appendChild(document.createElement("style"));
  style.textContent = "@keyframes rv-fade { from { opacity: 0 } to { opacity: 1 } }";
  render(() => <Box open={open} style={{ animation: "rv-fade 120ms" }} />);
  const box = document.getElementById("box")!;
  await flush();
  expect(box.getAttribute("data-entering")).toBe("true");
  await new Promise((r) => setTimeout(r, 250));
  expect(box.hasAttribute("data-entering")).toBe(false);
  style.remove();
});

// Regression (user report 2026-10-12 "motion modal exit is buggy"): a ui Modal backdrop's CSS exit (~140 ms) ended
// while the onExit promise (a nested @rivetjs/motion exit, 250 ms) still held the unmount: the backdrop snapped back
// to its open opacity until the unmount (a flash). The exit animation now holds its end state.
test("a CSS exit animation shorter than the onExit promise holds its end state until the unmount", async () => {
  const open = signal(true);
  const exit = deferred();
  const style = document.head.appendChild(document.createElement("style"));
  style.textContent = "@keyframes rv-out { from { opacity: 1 } to { opacity: 0 } } #box[data-exiting] { animation: rv-out 60ms linear }";
  render(() => <Box open={open} onExit={() => exit.promise} />);
  await flush();
  open.set(false);
  await flush();
  const box = document.getElementById("box")!;
  expect(box.getAttribute("data-exiting")).toBe("true");
  await new Promise((r) => setTimeout(r, 200));
  expect(box.isConnected).toBe(true);
  expect(getComputedStyle(box).opacity).toBe("0");
  exit.resolve();
  await flush();
  await new Promise((r) => setTimeout(r, 0));
  expect(box.isConnected).toBe(false);
  style.remove();
});

// Review N1: on a resumed page the state binding can commit after the effect (the first interaction re-creates the
// region, e.g. dismissing a server-open modal): the CSS exit it starts is held and awaited with the onExit promise too.
test("a CSS exit animation starting after the effect is held while the onExit promise is pending", async () => {
  const open = signal(true);
  const exit = deferred();
  const style = document.head.appendChild(document.createElement("style"));
  style.textContent = "@keyframes rv-out2 { from { opacity: 1 } to { opacity: 0 } } #box.late { animation: rv-out2 60ms linear }";
  render(() => (
    <Box
      open={open}
      onExit={(el) => {
        // The exit animation starts a microtask after the effect (its class / attribute binding commits later).
        queueMicrotask(() => el.classList.add("late"));
        return exit.promise;
      }}
    />
  ));
  await flush();
  open.set(false);
  await flush();
  const box = document.getElementById("box")!;
  await new Promise((r) => setTimeout(r, 200));
  expect(box.isConnected).toBe(true);
  expect(getComputedStyle(box).opacity).toBe("0");
  exit.resolve();
  await flush();
  await new Promise((r) => setTimeout(r, 0));
  expect(box.isConnected).toBe(false);
  style.remove();
});

// Review N2: a rejected onExit ends the exit (unmount) and reports the error, instead of leaving the overlay mounted.
test("a rejected onExit promise unmounts and reports the error", async () => {
  const open = signal(true);
  const errors: unknown[] = [];
  const report = vi.spyOn(globalThis, "reportError").mockImplementation((e) => void errors.push(e));
  onTestFinished(() => report.mockRestore());
  render(() => <Box open={open} onExit={() => Promise.reject(new Error("exit failed"))} />);
  await flush();
  open.set(false);
  await flush();
  await new Promise((r) => setTimeout(r, 0));
  expect(document.getElementById("box")).toBeNull();
  expect(errors.map((e) => (e as Error).message)).toEqual(["exit failed"]);
});

// Dismissing a server-open overlay as a resumed page's first interaction: the region re-created on the close gets the
// server's "was open" back (`_regionState`) and exits, instead of unmounting at once (no exit at all).
test("re-created closed by a resumed region that the server rendered open: plays the exit, then unmounts", async () => {
  const open = signal(false);
  const style = document.head.appendChild(document.createElement("style"));
  style.textContent = "@keyframes rv-out3 { from { opacity: 1 } to { opacity: 0 } } #box[data-exiting] { animation: rv-out3 80ms linear }";
  // The resume adoption's hook: the region read's `_regionState` calls get the server render's values (open: true).
  let served = false;
  const previous = _setRegionStateHook(<T,>(create: () => T): T => (served ? create() : ((served = true), true as T)));
  try {
    render(() => <Box open={open} />);
  } finally {
    _setRegionStateHook(previous);
  }
  const box = document.getElementById("box")!;
  expect(box?.getAttribute("data-exiting")).toBe("true");
  await new Promise((r) => setTimeout(r, 200));
  expect(document.getElementById("box")).toBeNull();
  style.remove();
});

test("reopening interrupts the exit", async () => {
  const open = signal(true);
  const exit = deferred();
  render(() => <Box open={open} onExit={() => exit.promise} />);
  await flush();
  open.set(false);
  await flush();
  const box = document.getElementById("box")!;
  expect(box.getAttribute("data-exiting")).toBe("true");
  open.set(true);
  expect(box.hasAttribute("data-exiting")).toBe(false);
  exit.resolve();
  await flush();
  expect(box.isConnected).toBe(true);
});

// Regression (BACKDROP-FIX 2026-10-08): a ModalOverlay whose backdrop fades with a CSS transition keyed on
// `data-entering` / `data-exiting` (HeroUI drawer / sheet backdrops). The overlay's portal host is moved into
// `document.body` by the Portal's own client effect, queued after the enter animation's: the enter used to end
// before the move, so the re-inserted backdrop had no entering style to transition from and appeared at once.
test("portaled ModalOverlay: a transition-based backdrop fades in and out", async () => {
  const style = document.head.appendChild(document.createElement("style"));
  style.textContent =
    ".bd { opacity: 1; transition: opacity 300ms linear; } .bd[data-entering], .bd[data-exiting] { opacity: 0; }" +
    " .bd-modal { translate: 0 0; transition: translate 300ms linear; } .bd[data-entering] .bd-modal { translate: 0 100%; }";
  const open = signal(false);
  render(() => (
    <ModalOverlay class="bd" isOpen={open} onOpenChange={(v) => open.set(v)}>
      <Modal class="bd-modal">
        <Dialog aria-label="Sheet">sheet</Dialog>
      </Modal>
    </ModalOverlay>
  ));
  open.set(true);
  await flush();
  const backdrop = document.querySelector<HTMLElement>(".bd")!;
  expect(backdrop.closest("[data-rivet-portal]")!.parentNode).toBe(document.body);
  const transitions = (el: Element) => el.getAnimations().filter((a) => a instanceof CSSTransition && a.playState === "running");
  expect(transitions(backdrop).length).toBe(1);
  await new Promise((r) => setTimeout(r, 120));
  const mid = Number(getComputedStyle(backdrop).opacity);
  expect(mid).toBeGreaterThan(0);
  expect(mid).toBeLessThan(1);
  expect(transitions(document.querySelector(".bd-modal")!).length).toBe(1);
  await new Promise((r) => setTimeout(r, 300));
  expect(getComputedStyle(backdrop).opacity).toBe("1");

  open.set(false);
  await flush();
  expect(backdrop.getAttribute("data-exiting")).toBe("true");
  expect(transitions(backdrop).length).toBe(1);
  await new Promise((r) => setTimeout(r, 120));
  const out = Number(getComputedStyle(backdrop).opacity);
  expect(out).toBeGreaterThan(0);
  expect(out).toBeLessThan(1);
  expect(backdrop.isConnected).toBe(true);
  await new Promise((r) => setTimeout(r, 350));
  expect(backdrop.isConnected).toBe(false);
  style.remove();
});

// Motion token (motion spec D17): `--rv-motion-spring` set on an ancestor → the overlay's animations / transitions run
// on a spring `linear()` curve (inline, read once per open); unset → no inline timing (unchanged behaviour). Opt-in
// through `modalHooks.open` (@rivetjs/ui's overlays register it).
test("ModalOverlay motion token: spring linear() timing when --rv-motion-spring is set, none when unset", async () => {
  const { springCurve } = await import("../utils/motion-token.ts");
  const { modalHooks, applyMotionToken } = await import("../modal/index.tsx");
  const before = modalHooks.open;
  modalHooks.open = (overlay, modal) => (applyMotionToken(overlay), applyMotionToken(modal));
  onTestFinished(() => void (modalHooks.open = before));
  const open = signal(false);
  render(() => (
    <ModalOverlay class="tk" isOpen={open} onOpenChange={(v) => open.set(v)}>
      <Modal class="tk-modal">
        <Dialog aria-label="Token">token</Dialog>
      </Modal>
    </ModalOverlay>
  ));
  open.set(true);
  await flush();
  await Promise.resolve();
  expect(document.querySelector<HTMLElement>(".tk")!.style.animationTimingFunction).toBe("");
  expect(document.querySelector<HTMLElement>(".tk-modal")!.style.transitionDuration).toBe("");
  open.set(false);
  await new Promise((r) => setTimeout(r, 50));
  await flush();

  document.body.style.setProperty("--rv-motion-spring", "0.3 0.2");
  try {
    open.set(true);
    await flush();
    await Promise.resolve();
    const [easing, duration] = springCurve(0.3, 0.2);
    expect(easing).toMatch(/^linear\(0,/);
    // Under-damped (bounce 0.2): the curve overshoots 1 before it settles.
    expect(easing.split(",").some((n) => Number(n.replace(/[^\d.]/g, "")) > 1)).toBe(true);
    for (const selector of [".tk", ".tk-modal"]) {
      const style = document.querySelector<HTMLElement>(selector)!.style;
      expect(style.animationTimingFunction).toMatch(/^linear\(/);
      expect(style.animationDuration).toBe(duration);
      expect(style.transitionDuration).toBe(duration);
    }
  } finally {
    document.body.style.removeProperty("--rv-motion-spring");
  }
});
