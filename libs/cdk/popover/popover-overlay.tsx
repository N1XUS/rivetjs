// Ported from React Aria Components (Popover.tsx) and React Aria (usePopover, Overlay, DismissButton),
// Apache-2.0, © Adobe.
// LEGACY SHIM (internal): `PopoverOverlay` = a popover without a trigger for components that render their
// own trigger and pass a shared state + `triggerId` (menu, select, date-picker). They move to `<Popover>`
// fed by `PopoverContext` (RAC) in their re-ports; delete this file with its last consumer.
// Rivet: renders in the div overlay layer while open or animating out (`@rivetjs/kit/transition` class
// props + data-entering / data-exiting); usePopover from a client effect (`attachPopoverOverlay`).
// RAC parity kept here: a modal popover contains focus whatever its role (RAC: a modal Popover is a
// dialog, and a Dialog inside it contains focus too).
import type { Content, Slot } from "@rivetjs/runtime/jsx-runtime";
import { clientEffect } from "@rivetjs/runtime/dom";
import { createTransition, TransitionPresence, type TransitionClasses, type TransitionController } from "@rivetjs/kit/transition";
import { renderSlot } from "@rivetjs/runtime/slot";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { DismissButton } from "../overlay/dismiss-button.tsx";
import { Overlay } from "../portal/index.tsx";
import { closeOverlay, type OverlayTriggerState } from "../state/overlays.ts";
import { attachPopoverOverlay, type PopoverOverlayOptions } from "./behaviour.ts";

/** @internal */
export interface PopoverOverlayProps extends Omit<PopoverOverlayOptions, "triggerId">, TransitionClasses, GlobalDOMAttributes<HTMLDivElement> {
  id: string;
  triggerId: string;
  state: OverlayTriggerState;
  /** Role of the popover element. `null`: none (menus, listboxes inside). @default 'dialog' */
  role?: string | null;
  class?: string;
  /** Heading of the popover. */
  title?: Content;
  /** Run the enter transition when the popover is open on first render. */
  appear?: boolean;
  /** Called with the popover element when it opened (after usePopover attached). */
  onOpened?: (element: HTMLElement) => void;
  /** Extra attributes of the popover element. */
  attributes?: Record<string, unknown>;
  children?: Content | Slot<[{ close: () => void }]>;
}

/** @internal The popover part without a trigger (legacy shim for menu / select / date-picker). */
export function PopoverOverlay(props: PopoverOverlayProps) {
  const state = props.state;
  const t = createTransition(state.isOpen, {
    appear: props.appear,
    enter: props.enter,
    enterFrom: props.enterFrom,
    enterTo: props.enterTo,
    entered: props.entered,
    leave: props.leave,
    leaveFrom: props.leaveFrom,
    leaveTo: props.leaveTo,
    ariaComponents: true,
  });
  return <TransitionPresence transition={t}>{() => <PopoverOverlayContent {...props} t={t} />}</TransitionPresence>;
}

function PopoverOverlayContent(props: PopoverOverlayProps & { t: TransitionController }) {
  const { id, state, t } = props;
  const options: PopoverOverlayOptions = {
    triggerId: props.triggerId,
    placement: props.placement ?? "bottom",
    offset: props.offset,
    crossOffset: props.crossOffset,
    containerPadding: props.containerPadding,
    shouldFlip: props.shouldFlip,
    maxHeight: props.maxHeight,
    arrowBoundaryOffset: props.arrowBoundaryOffset,
    boundaryId: props.boundaryId,
    isNonModal: props.isNonModal,
    isKeyboardDismissDisabled: props.isKeyboardDismissDisabled,
    shouldCloseOnInteractOutside: props.shouldCloseOnInteractOutside,
  };
  const role = props.role === undefined ? "dialog" : props.role;
  const isDialog = role === "dialog";
  const hasTitle = props.title != null;
  const children = props.children;
  const onOpened = props.onOpened;
  const isNonModal = !!props.isNonModal;
  const domProps = globalDOMProps(props),
    attributes = props.attributes,
    className = props.class ?? "rv-Popover",
    labelledBy = role ? (hasTitle ? id + "-title" : props.triggerId) : undefined;
  clientEffect(() => attachPopoverOverlay(t.ref(), state, options, isDialog, onOpened), { when: "load" });
  return (
    <Overlay shouldContainFocus={!isNonModal}>
      {!isNonModal && state.isOpen() ? <div data-testid="underlay" data-rv-underlay="" style={{ position: "fixed", inset: "0" }} /> : null}
      <div
        {...domProps}
        {...attributes}
        id={id}
        class={t.className(className)}
        {...t.attributes()}
        ref={t.ref}
        role={role ?? undefined}
        tabIndex={role ? -1 : undefined}
        aria-labelledby={labelledBy}
        data-rv-overlay=""
      >
        {!isNonModal ? <DismissButton onDismiss={() => closeOverlay(state)} /> : null}
        {hasTitle ? (
          <h2 id={id + "-title"} data-slot="title">
            {props.title}
          </h2>
        ) : null}
        {renderSlot(children, { close: () => closeOverlay(state) })}
        <DismissButton onDismiss={() => closeOverlay(state)} />
      </div>
    </Overlay>
  );
}
