// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no pressable feedback). Feature set inspired by HeroUI Pro's public
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

const PressableFeedbackRipple = (props: PressableFeedbackRippleProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "duration", "hoverOpacity", "pressedOpacity", "minimumPressDuration", "isDisabled", "style"]);
  const layers = useContext(PressableFeedbackContext);
  let el: HTMLElement | undefined;
  let startedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  layers?.push({
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
  });
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
      ref={(node: HTMLElement) => (el = node)}
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
