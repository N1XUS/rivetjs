// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no pressable feedback). Feature set inspired by commercial UI kits' public
// Pressable Feedback docs (a press layer for any element: `.Highlight` opacity overlay, `.Ripple` M3-style radial ripple,
// `.HoldConfirm` clip-path hold-to-confirm, `.ProgressFeedback` clip-path click-to-progress; classes `.pressable-feedback*`,
// `data-sweep` / `data-holding` / `data-progressing` / `data-complete`, `--pressable-feedback-*` variables); independent
// implementation, Rivet-authored styles.
// - Root = cdk `Button` (`.pressable-feedback`): its press events (pointer, touch, keyboard Space / Enter, virtual) drive the
//   layers. The root keeps a per-instance list of layer handlers in a context (`rv-ui-pressable-feedback`); each layer
//   pushes `{ start, end, press }` when it renders and toggles data attributes on its own element (ref), CSS animates.
// - `.Highlight` is CSS only (`:hover` / `[data-hovered]` / `[data-pressed]` on the parent), usable outside the root.
// - `.Ripple`: press start sets `--pressable-feedback-ripple-{x,y,size}` from the press point (keyboard / virtual: centre) and
//   restarts the grow animation (`data-pressed`); press end fades it (`data-released`) after `minimumPressDuration`.
//   Standalone (no root context: inside a ui `Button` or any positioned pressable element) it drives itself from its parent
//   element: native `pointerdown` (press point; release on the document's `pointerup` / `pointercancel`) and `keydown`
//   Space / Enter on the parent itself, or Space on a native checkbox / radio inside it (a selectable card whose focus sits on
//   its hidden input) (centred; release on `keyup` / its `click` / `focusout`, Enter at once); a parent that is
//   `:disabled` / `aria-disabled` / `data-disabled` gets none. The listeners attach when the ripple's node is created or
//   adopted (a cold page: the first press adopts the parent's unit, the runtime records listeners added meanwhile and
//   replays the held press into them) and drop themselves once the ripple left that parent.
// - `.HoldConfirm`: press start → `data-holding` (clip-path reveal over `duration`); a timer completes it (`data-complete`,
//   `onComplete`); press end before that snaps back over `releaseDuration`; after a completed hold the press end resets it
//   unless `resetOnComplete={false}`.
// - `.ProgressFeedback`: a press → `data-progressing` over `duration` → `data-complete` + `onComplete`; `autoReset` resets after
//   `resetDelay` (`onReset`). Presses while progressing are ignored.
// - Nothing runs before input: the first press resumes the root, the layers register, the press replays.
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import type { PressEvent } from "@rivetjs/cdk/interactions/press";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { pressableFeedbackVariants } from "../../../styles/src/components/pressable-feedback/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

const SLOTS = pressableFeedbackVariants();

interface Layer {
  start?(e: PressEvent): void;
  end?(e: PressEvent): void;
  press?(e: PressEvent): void;
}

// A resumed page can register a layer twice (one copy holds a detached node): every layer skips a node that is not
// connected, so only the live layer runs.
const PressableFeedbackContext = createContext<Layer[] | null>(null);

type Sweep = "right" | "left" | "down" | "up";

/* -------------------------------------------------------------------------------------------------
 * PressableFeedback Root
 * -----------------------------------------------------------------------------------------------*/
interface PressableFeedbackRootProps extends ButtonPrimitiveProps {
  children?: Content | ((values: ButtonRenderProps) => Content);
}

function PressableFeedbackRoot(props: PressableFeedbackRootProps): JSX.Element {
  const [local, rest] = splitLive(props, ["class", "children", "onPressStart", "onPressEnd", "onPress"]);
  const layers: Layer[] = [];
  const cls = composeTwRenderProps(local.class as never, SLOTS.base()) as string | ((values: ButtonRenderProps) => string);
  const handlers = {
    onPressStart: (e: PressEvent) => {
      for (const layer of layers) layer.start?.(e);
      local.onPressStart?.(e);
    },
    onPressEnd: (e: PressEvent) => {
      for (const layer of layers) layer.end?.(e);
      local.onPressEnd?.(e);
    },
    onPress: (e: PressEvent) => {
      for (const layer of layers) layer.press?.(e);
      local.onPress?.(e);
    },
  };
  // A function: the layers must render inside the provider.
  const content = () => (
    <ButtonPrimitive data-slot="pressable-feedback" {...(rest as object)} {...handlers} class={cls as never}>
      {local.children as never}
    </ButtonPrimitive>
  );
  return (
    <Provider token={PressableFeedbackContext} value={layers}>
      {content()}
    </Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * PressableFeedback Highlight
 * -----------------------------------------------------------------------------------------------*/
type SpanProps = Omit<JSX.IntrinsicElements["span"], "class" | "children"> & { class?: string };

const PressableFeedbackHighlight = (props: SpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <span aria-hidden="true" class={composeSlotClassName(SLOTS.highlight, local.class)} data-slot="pressable-feedback-highlight" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * PressableFeedback Ripple
 * -----------------------------------------------------------------------------------------------*/
interface PressableFeedbackRippleProps extends SpanProps {
  /** Grow animation (ms). @default 150 */
  duration?: number;
  /** Hover overlay opacity. @default 0.08 */
  hoverOpacity?: number;
  /** Pressed ripple opacity. @default 0.12 */
  pressedOpacity?: number;
  /** Minimum time (ms) the ripple stays pressed. @default 225 */
  minimumPressDuration?: number;
  isDisabled?: boolean;
}

const restart = (el: HTMLElement, name: string) => {
  el.removeAttribute(name);
  void el.offsetWidth;
  el.setAttribute(name, "true");
};

// Standalone ripple: the parent element's own press (no PressableFeedback root). `start` / `end` take the root's PressEvent
// shape (`target` = the parent, `x` / `y` relative to it). Document capture listeners filtered to the parent: a cold
// press replays its held events into listeners its adopt run added, and a replay stops at an element once a delegated
// handler stopped propagation (cdk `usePress` does) — the document's capture phase still runs.
const selfDriven = (el: HTMLElement, layer: Required<Pick<Layer, "start" | "end">>): void => {
  const host = el.parentElement;
  if (!host) return;
  const ac = new AbortController(),
    on = { signal: ac.signal, capture: true },
    listen = (type: string, fn: (e: Event) => unknown) => host.ownerDocument.addEventListener(type, fn, on);
  let active: string | undefined;
  const live = () => (el.isConnected && el.parentElement === host) || (ac.abort(), false);
  const press = (pointerType: string, x = 0, y = 0) => ({ pointerType, target: host, x, y }) as unknown as PressEvent;
  const end = () => {
    if (active && live()) layer.end(press(active));
    active = undefined;
  };
  const begin = (pointerType: string, x?: number, y?: number) => {
    if (active || !live() || host.matches(":disabled,[aria-disabled=true],[data-disabled=true]")) return false;
    layer.start(press((active = pointerType), x, y));
    return true;
  };
  listen("pointerdown", (e) => {
    const { button, clientX, clientY, pointerType, target } = e as PointerEvent;
    if (button || !host.contains(target as Node)) return;
    const box = host.getBoundingClientRect();
    begin(pointerType, clientX - box.left, clientY - box.top);
  });
  for (const type of ["pointerup", "pointercancel"]) listen(type, () => active !== "keyboard" && end());
  // The key target: the parent itself (Space / Enter, as a button) or a native checkbox / radio inside it (Space only, as
  // the input): a selectable card (`label`, e.g. CheckboxButtonGroup / RadioButtonGroup items) keeps its keyboard focus on
  // its visually hidden input.
  let keyed: EventTarget | null = null;
  const pressKey = (target: EventTarget | null, key: string): boolean => {
    if (target === host) return key === " " || key === "Enter";
    const input = target as HTMLInputElement | null;
    return key === " " && input?.localName === "input" && (input.type === "checkbox" || input.type === "radio") && !input.disabled && host.contains(input);
  };
  listen("keydown", (e) => {
    const { key, repeat, target } = e as KeyboardEvent;
    if (repeat || !pressKey(target, key) || !begin("keyboard")) return;
    keyed = target;
    if (key === "Enter") end();
  });
  // A cold keyup is not held (not a delegated type) and may land before the adopt run: the native button's / input's
  // Space click, which is held and replayed, ends the press too.
  for (const type of ["keyup", "focusout", "click"]) listen(type, (e) => e.target === keyed && active === "keyboard" && end());
};

const PressableFeedbackRipple = (props: PressableFeedbackRippleProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "duration", "hoverOpacity", "pressedOpacity", "minimumPressDuration", "isDisabled", "style"]);
  const layers = useContext(PressableFeedbackContext);
  let el: HTMLElement | undefined;
  let startedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const layer: Required<Pick<Layer, "start" | "end">> = {
    start(e) {
      if (!el?.isConnected || local.isDisabled) return;
      clearTimeout(timer);
      const box = el.getBoundingClientRect();
      const keyed = e.pointerType === "keyboard" || e.pointerType === "virtual";
      const from = e.target.getBoundingClientRect();
      const x = keyed ? box.width / 2 : from.left + e.x - box.left;
      const y = keyed ? box.height / 2 : from.top + e.y - box.top;
      const size = 2 * Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y));
      el.style.setProperty("--pressable-feedback-ripple-x", `${x}px`);
      el.style.setProperty("--pressable-feedback-ripple-y", `${y}px`);
      el.style.setProperty("--pressable-feedback-ripple-size", `${size}px`);
      el.removeAttribute("data-released");
      restart(el, "data-pressed");
      startedAt = performance.now();
    },
    end() {
      if (!el?.isConnected || !el.hasAttribute("data-pressed")) return;
      const wait = Math.max(0, (local.minimumPressDuration ?? 225) - (performance.now() - startedAt));
      timer = setTimeout(() => el?.setAttribute("data-released", "true"), wait);
    },
  };
  layers?.push(layer);
  // Standalone: drive it from the parent once the node is in place (a client render inserts it after the ref).
  const own = (node: HTMLElement) => (node.parentElement ? selfDriven(node, layer) : queueMicrotask(() => selfDriven(node, layer)));
  const style = {
    "--pressable-feedback-ripple-duration": `${local.duration ?? 150}ms`,
    ...(local.hoverOpacity == null ? {} : { "--pressable-feedback-ripple-hover-opacity": String(local.hoverOpacity) }),
    ...(local.pressedOpacity == null ? {} : { "--pressable-feedback-ripple-pressed-opacity": String(local.pressedOpacity) }),
    ...((local.style as object | undefined) ?? {}),
  };
  return (
    <span
      aria-hidden="true"
      class={composeSlotClassName(SLOTS.ripple, local.class)}
      data-slot="pressable-feedback-ripple"
      data-disabled={local.isDisabled ? "true" : undefined}
      {...rest}
      style={style}
      ref={(node: HTMLElement) => ((el = node), layers || own(node))}
    >
      <span class={SLOTS.rippleSurface()} />
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * PressableFeedback HoldConfirm
 * -----------------------------------------------------------------------------------------------*/
interface PressableFeedbackHoldConfirmProps extends SpanProps {
  /** Hold time (ms) until the action is confirmed. @default 2000 */
  duration?: number;
  /** Snap-back time (ms) on release. @default 200 */
  releaseDuration?: number;
  /** Edge the reveal sweeps toward. @default "right" */
  sweep?: Sweep;
  /** Reset the overlay when the completed press ends. @default true */
  resetOnComplete?: boolean;
  isDisabled?: boolean;
  /** The hold reached `duration`. */
  onComplete?: () => void;
  /** Overlay content shown during the reveal. */
  children?: Content;
}

const PressableFeedbackHoldConfirm = (props: PressableFeedbackHoldConfirmProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "duration", "releaseDuration", "sweep", "resetOnComplete", "isDisabled", "onComplete", "style"]);
  const layers = useContext(PressableFeedbackContext);
  let el: HTMLElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  layers?.push({
    start() {
      if (!el?.isConnected || local.isDisabled || el.hasAttribute("data-complete") || el.hasAttribute("data-holding")) return;
      el.setAttribute("data-holding", "true");
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!el) return;
        el.setAttribute("data-complete", "true");
        el.removeAttribute("data-holding");
        local.onComplete?.();
      }, local.duration ?? 2000);
    },
    end() {
      if (!el?.isConnected) return;
      clearTimeout(timer);
      el.removeAttribute("data-holding");
      if (el.hasAttribute("data-complete") && local.resetOnComplete !== false) el.removeAttribute("data-complete");
    },
  });
  const style = {
    "--pressable-feedback-hold-confirm-duration": `${local.duration ?? 2000}ms`,
    "--pressable-feedback-hold-confirm-release-duration": `${local.releaseDuration ?? 200}ms`,
    ...((local.style as object | undefined) ?? {}),
  };
  return (
    <span
      aria-hidden="true"
      class={composeSlotClassName(SLOTS.holdConfirm, local.class)}
      data-slot="pressable-feedback-hold-confirm"
      data-sweep={local.sweep ?? "right"}
      {...rest}
      style={style}
      ref={(node: HTMLElement) => (el = node)}
    >
      {local.children}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * PressableFeedback ProgressFeedback
 * -----------------------------------------------------------------------------------------------*/
interface PressableFeedbackProgressFeedbackProps extends SpanProps {
  /** Progress time (ms) until the action is confirmed. @default 2000 */
  duration?: number;
  /** Snap-back time (ms) on reset. @default 300 */
  releaseDuration?: number;
  /** Edge the reveal sweeps toward. @default "right" */
  sweep?: Sweep;
  /** Reset after completing. @default true */
  autoReset?: boolean;
  /** Delay (ms) before the reset. @default 1500 */
  resetDelay?: number;
  isDisabled?: boolean;
  /** The progress reached `duration`. */
  onComplete?: () => void;
  /** The overlay went back to idle. */
  onReset?: () => void;
  /** Overlay content shown during the reveal. */
  children?: Content;
}

const PressableFeedbackProgressFeedback = (props: PressableFeedbackProgressFeedbackProps): JSX.Element => {
  const [local, rest] = splitLive(props, [
    "class",
    "children",
    "duration",
    "releaseDuration",
    "sweep",
    "autoReset",
    "resetDelay",
    "isDisabled",
    "onComplete",
    "onReset",
    "style",
  ]);
  const layers = useContext(PressableFeedbackContext);
  let el: HTMLElement | undefined;
  layers?.push({
    press() {
      if (!el?.isConnected || local.isDisabled || el.hasAttribute("data-progressing") || el.hasAttribute("data-complete")) return;
      el.setAttribute("data-progressing", "true");
      setTimeout(() => {
        if (!el) return;
        el.setAttribute("data-complete", "true");
        el.removeAttribute("data-progressing");
        local.onComplete?.();
        if (local.autoReset === false) return;
        setTimeout(() => {
          el?.removeAttribute("data-complete");
          local.onReset?.();
        }, local.resetDelay ?? 1500);
      }, local.duration ?? 2000);
    },
  });
  const style = {
    "--pressable-feedback-progress-feedback-duration": `${local.duration ?? 2000}ms`,
    "--pressable-feedback-progress-feedback-release-duration": `${local.releaseDuration ?? 300}ms`,
    ...((local.style as object | undefined) ?? {}),
  };
  return (
    <span
      aria-hidden="true"
      class={composeSlotClassName(SLOTS.progressFeedback, local.class)}
      data-slot="pressable-feedback-progress-feedback"
      data-sweep={local.sweep ?? "right"}
      {...rest}
      style={style}
      ref={(node: HTMLElement) => (el = node)}
    >
      {local.children}
    </span>
  );
};

export { PressableFeedbackRoot, PressableFeedbackHighlight, PressableFeedbackRipple, PressableFeedbackHoldConfirm, PressableFeedbackProgressFeedback };
export type {
  PressableFeedbackRootProps,
  SpanProps as PressableFeedbackHighlightProps,
  PressableFeedbackRippleProps,
  PressableFeedbackHoldConfirmProps,
  PressableFeedbackProgressFeedbackProps,
};
