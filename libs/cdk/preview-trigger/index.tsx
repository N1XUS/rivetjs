// Ported from React Aria Components (PreviewTrigger.tsx), Apache-2.0, © Adobe.
// A PreviewTrigger displays a popover with a preview of a link's destination (or any rich content) on
// hover, keyboard focus, or touch long press: `<PreviewTrigger><Link/><Popover>…</Popover></PreviewTrigger>`.
// Unlike a tooltip, the popover may contain interactive content (Tab from the trigger moves into it).
// Rivet:
// - state: `createTooltipTriggerState({ delay: 600, closeDelay: 200 })` (shared warmup with tooltips),
//   provided as `OverlayTriggerStateContext`; the Popover gets `PopoverContext` `{ trigger:
//   "PreviewTrigger", triggerRef, ref, isNonModal: true, shouldSkipAnimation, id, onFocusWithin,
//   onBlurWithin }` (RAC).
// - the trigger props reach the child (a cdk Link / Button, or a custom element in `<Focusable>`) through
//   FocusableProvider (RAC); `aria-haspopup="dialog"` is server-rendered, `aria-expanded` /
//   `aria-controls` / `aria-describedby` are set on the trigger while the preview is open; the touch long
//   press and the FocusScope restore listener are installed on the trigger at its first pointerenter /
//   focus (delegated useLongPress / RA `useEvent(triggerRef, …)`).
// - RA's effects (safe area, focus after long press, ARIA) run from a client effect in an own binding
//   site (`span[data-rv-overlay-anchor]`) only while open — nothing at load.
// Not yet supported: the long press accessibility description ("Long press to open preview").
import { untrack } from "@rivetjs/reactivity";
import { Show, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { FocusableProvider } from "../focus/focusable.tsx";
import { Provider } from "../slots/index.tsx";
import { idSignal } from "../utils/id.ts";
import { OverlayTriggerStateContext, PopoverContext } from "../overlay/contexts.ts";
import { createTooltipTriggerState, type TooltipTriggerProps, type TooltipTriggerState } from "../state/tooltip.ts";
import {
  attachPreviewTrigger,
  previewTriggerBlur,
  previewTriggerCheckClose,
  previewTriggerFocus,
  previewTriggerKeepOpen,
  previewTriggerKeyDown,
  previewTriggerPointerEnter,
  previewTriggerPointerLeave,
  type AriaPreviewTriggerOptions,
} from "./behaviour.tsx";
import { liveOptions } from "../utils/live.tsx";

export interface PreviewTriggerProps extends Omit<TooltipTriggerProps, "trigger" | "shouldCloseOnPress"> {
  /** The delay time for the preview to show up (ms). @default 600 */
  delay?: number;
  /** The delay time for the preview to close (ms). @default 200 */
  closeDelay?: number;
  /** The trigger (e.g. a Link) and its `<Popover>`. */
  children?: Content;
}

/** A PreviewTrigger displays a popover preview on hover, focus or long press of its trigger. */
export function PreviewTrigger(props: PreviewTriggerProps) {
  const state: TooltipTriggerState = createTooltipTriggerState({
    ...liveOptions(props, [], ["isOpen"]),
    delay: props.delay ?? 600,
    closeDelay: props.closeDelay ?? 200,
  });
  const triggerRef = createRef<HTMLElement>();
  const popoverRef = createRef<HTMLElement>();
  // RA mergeIds: a user `id` on the Popover replaces the generated one (the signal travels as `idRef`).
  const popoverIdRef = idSignal();
  const popoverId = untrack(popoverIdRef);
  const isDisabled = props.isDisabled;
  const options: AriaPreviewTriggerOptions = {
    isDisabled,
    triggerRef: () => triggerRef(),
    popoverRef: () => popoverRef(),
    popoverId,
  };
  const children = props.children;
  const popover = {
    trigger: "PreviewTrigger",
    triggerRef,
    ref: popoverRef,
    isNonModal: true,
    shouldSkipAnimation: () => state.shouldSkipAnimation(),
    id: popoverId,
    idRef: popoverIdRef,
    onFocusWithin: () => previewTriggerKeepOpen(state),
    onBlurWithin: () => previewTriggerCheckClose(state, options),
  };
  return (
    <>
      <Provider
        values={[
          [OverlayTriggerStateContext, state],
          [PopoverContext, popover],
        ]}
      >
        {() => (
          <FocusableProvider
            ref={triggerRef}
            aria-haspopup="dialog"
            aria-expanded={() => state.isOpen()}
            aria-controls={() => (state.isOpen() ? popoverIdRef() : undefined)}
            aria-describedby={() => (state.isOpen() ? popoverIdRef() : undefined)}
            onPointerEnter={(event: PointerEvent) => previewTriggerPointerEnter(event, options, state)}
            onPointerLeave={(event: PointerEvent) => previewTriggerPointerLeave(event, options, state)}
            onFocus={(event: FocusEvent) => previewTriggerFocus(event, options, state)}
            onBlur={(event: FocusEvent) => previewTriggerBlur(event, options, state)}
            onKeyDown={(event: KeyboardEvent) => previewTriggerKeyDown(event, options, state)}
          >
            {children}
          </FocusableProvider>
        )}
      </Provider>
      <span data-rv-overlay-anchor="" style={{ display: "contents" }}>
        <Show when={() => state.isOpen()}>{() => <PreviewEffects state={state} options={options} />}</Show>
      </span>
    </>
  );
}

/** RA usePreviewTrigger's effects while open (safe area, focus after long press, the trigger's ARIA). */
function PreviewEffects(props: { state: TooltipTriggerState; options: AriaPreviewTriggerOptions }): Content {
  const { state, options } = props;
  clientEffect(() => {
    // Wait for the popover (RA: effects after the popover rendered).
    if (!options.popoverRef || !(typeof options.popoverRef === "function" ? options.popoverRef() : options.popoverRef)) return;
    return attachPreviewTrigger(state, options);
  });
  return null;
}
