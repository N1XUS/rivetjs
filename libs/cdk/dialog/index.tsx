// Ported from packages/react-aria-components/src/Dialog.tsx (DialogTrigger, Dialog), Apache-2.0, © Adobe.
// RAC composition: `<DialogTrigger><Button/><Modal|Popover><Dialog>…</Dialog></…></DialogTrigger>`.
// Rivet:
// - `DialogTrigger` renders no element: it provides OverlayTriggerStateContext / DialogContext /
//   PopoverContext (`../overlay/contexts.ts`) and a `PressResponder` whose trigger props reach the user's
//   `<Button>` (`aria-expanded` / `aria-controls` / `isPressed` as accessors, read in the button's bindings).
//   State = `createMenuTriggerState` (react-stately useMenuTriggerState, so a menu inside the dialog can
//   open submenus); the trigger ref is a `ref()`.
// - `Dialog`: useDialog = `dialogProps` (./behaviour.tsx) with slot ids (`createSlotId`): the Heading
//   (`slot="title"`) and Text (`slot="description"`) mark them rendered (with their own `id` prop when set: RA
//   mergeIds, the owner follows it). Server: the children are called inside the body Provider's slot, which runs
//   while `body` is built, before the `<section>` record reads its attributes, so `aria-labelledby` /
//   `aria-describedby` are final in the server HTML; client: an accessor (reactive binding), the attribute
//   bindings follow the slot ids' `rendered` signals. No title → the trigger id from context (RAC fallback).
//   `close` = `closeOverlay` of the context state.
// - render props / `class` / `style` functions via `renderProps` (`../slots`); default class `rv-Dialog`.
//   Client: children reach the body Provider as `[() => rp.children()]` (a reactive binding): plain text children
//   (`A {p()}`) update like RAC re-renders; Provider alone resolves its slot once. Server: `rp.children()` (above).
// - `trigger` (DialogTrigger): Rivet extension, RAC vocabulary — see DialogTriggerProps.trigger; hover / focus use
//   `../overlay/hover-trigger.tsx` (safe area attached while open from an own anchor site), longPress RA useLongPress.
// `render` (RAC DOMRenderProps, renderProps `undefined`) replaces the `<section>`. Deviations: an `[autofocus]` descendant is focused on mount (React's `autoFocus`); the iOS VoiceOver refocus and the focus-on-mount run from a client effect
// (a server-rendered Dialog whose effect wakes after the user moved focus does not take it: `focusMovedByUser`);
// in a collection's hidden build pass (`isHidden()`) DialogTrigger renders nothing (RAC `useIsHidden`).
import { untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { Show, clientEffect, ref as createRef, type Ref } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { resumedId, idSignal } from "../utils/id.ts";
import { DEV, isFocusWithin } from "../utils/dom-core.ts";
import { focusMovedByUser, focusSafely } from "../focus/index.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import { PressResponder, type PressResponderProps } from "../interactions/pressable.tsx";
import { OverlayTriggerStateContext, PopoverContext } from "../overlay/contexts.ts";
import { closeOverlay, openOverlay, type OverlayTriggerProps } from "../state/overlays.ts";
import { createMenuTriggerState, toggleMenu, type MenuTriggerState } from "../state/menu-trigger.ts";
import type { PressEvent } from "../interactions/press.tsx";
import { longPressEnd, longPressStart } from "../interactions/long-press.tsx";
import {
  attachHoverTrigger,
  hoverTriggerBlur,
  hoverTriggerFocus,
  hoverTriggerOverlayBlurWithin,
  hoverTriggerOverlayFocusWithin,
  hoverTriggerPointerEnter,
  hoverTriggerPointerLeave,
  type HoverTriggerProps,
  type OverlayTriggerMode,
} from "../overlay/hover-trigger.tsx";
import { isHidden } from "../collections/hidden.ts";
import { ButtonContext } from "../button/index.tsx";
import { HeadingContext } from "../heading/index.tsx";
import { TextContext } from "../text/index.tsx";
import { probeSlots, slotProbing } from "#server";
import {
  DEFAULT_SLOT,
  Provider,
  contextProps,
  createSlotId,
  mergeRefValues,
  renderProps,
  type ContextValue,
  type RefValue,
  type SlotProps,
  type StyleOrFunction,
} from "../slots/index.tsx";
import { dialogBlur, dialogFocus, dialogProps, dialogTitleWarning, type AriaDialogProps } from "./behaviour.tsx";
import { DialogContext, type DialogContextValue } from "./contexts.ts";
import { renderPropsOf } from "../slots/index.tsx";
import { hasLive, liveOptions } from "../utils/live.tsx";

export { DialogContext, OverlayTriggerStateContext };

export interface DialogTriggerProps extends OverlayTriggerProps {
  children?: Content;
  /**
   * Rivet extension (RAC vocabulary): the interaction that opens the overlay. `"press"` (RAC) toggles on
   * press; `"longPress"` opens on a long press (keyboard / screen reader press still toggles); `"hover"`
   * opens on mouse / pen hover after `delay` and keyboard focus, with a safe area between trigger and
   * popover (touch keeps the press toggle); `"focus"` opens on keyboard focus (press still toggles).
   * Read once at mount (it picks the trigger implementation).
   * @default 'press'
   */
  trigger?: OverlayTriggerMode;
  /** `trigger="hover"`: delay before opening (ms). Live (read at event time). @default 300 */
  delay?: number;
  /** `trigger="hover"`: delay before closing once the pointer left the safe area (ms). Live (read at event time). @default 200 */
  closeDelay?: number;
  /** `trigger="longPress"`: description for assistive technology, e.g. "Long press to open". Read once at mount. */
  longPressAccessibilityDescription?: string;
}

export interface DialogRenderProps {
  /** Closes the dialog (the overlay state of the nearest DialogTrigger / Modal / Popover). */
  close: () => void;
}

export interface DialogProps
  extends Omit<AriaDialogProps, "isEntering">, SlotProps, DOMRenderProps<"section", undefined>, Omit<GlobalDOMAttributes<HTMLElement>, "style"> {
  /** Whether the dialog is performing an entry animation (focus waits for it); a value or an accessor. */
  isEntering?: MaybeAccessor<boolean | undefined>;
  /** The CSS class of the element. @default 'rv-Dialog' */
  class?: string;
  /** The inline style of the element. */
  style?: StyleOrFunction<DialogRenderProps>;
  /** Children of the dialog. A function may be provided to access a function to close the dialog. */
  children?: Content | ((opts: DialogRenderProps) => Content);
  ref?: RefValue<HTMLElement>;
}

/** A DialogTrigger opens a dialog when a trigger element is pressed (RAC `DialogTrigger`). */
export function DialogTrigger(props: DialogTriggerProps) {
  // Use the menu trigger state instead of the overlay trigger state in case a menu is embedded in the dialog.
  // This is needed to handle submenus.
  // Live props: a controlled `isOpen={open()}` stays live (accessor; `controllable` reads it, never writes it).
  const state = createMenuTriggerState({ isOpen: liveOptions(props, [], ["isOpen"]).isOpen, defaultOpen: props.defaultOpen, onOpenChange: props.onOpenChange });
  const buttonRef = createRef<HTMLButtonElement>();

  // useOverlayTrigger({ type: "dialog" }): no aria-haspopup for dialogs; `aria-controls` while open.
  const overlayId = idSignal();
  // Label dialog by the trigger as a fallback if there is no title slot.
  // This is done in RAC instead of hooks because otherwise we cannot distinguish
  // between context and props. Normally aria-labelledby overrides the title
  // but when sent by context we want the title to win.
  const triggerId = idSignal();

  // Initial ids (plain strings for the contexts / trigger props; a merged id updates the signals, read in accessors).
  const initialOverlayId = untrack(overlayId),
    initialTriggerId = untrack(triggerId);

  // If within a collection (e.g. Tabs), render nothing.
  if (isHidden()) return null;

  const children = props.children;
  const mode = props.trigger ?? "press";
  // Live `delay` / `closeDelay` (LIVE-SWEEP round 2): accessors the hover handlers read at event time.
  const timing = hasLive(props) ? liveOptions(props, ["delay", "closeDelay"]) : props;
  // useOverlayTrigger trigger props (accessors: read in the Button's bindings).
  const triggerProps = {
    id: initialTriggerId,
    "aria-expanded": () => state.isOpen(),
    "aria-controls": () => (state.isOpen() ? overlayId() : undefined),
  } as PressResponderProps;
  // Server, open: the trigger's `aria-controls` is written before the Dialog renders, so a Dialog with its own `id` (RA
  // mergeIds, `idRef`) would leave the generated id in the server HTML (an IDREF to nothing; the client render follows
  // the merge). Probe the children first (`probeSlots`, browser: a no-op): a probed Dialog sets `idRef` and renders
  // nothing. Only server-open triggers pay the probe (their overlay subtree renders twice up to the Dialog).
  if (SERVER && untrack(state.isOpen))
    probeSlots(
      [
        [OverlayTriggerStateContext, state],
        [DialogContext, { id: initialOverlayId, idRef: overlayId }],
      ],
      children,
    );
  if (mode === "press" || mode === "focus") {
    return (
      <Provider
        values={[
          [OverlayTriggerStateContext, state],
          [DialogContext, { id: initialOverlayId, "aria-labelledby": () => triggerId(), idRef: overlayId }],
          [PopoverContext, { trigger: "DialogTrigger", triggerRef: buttonRef, id: initialOverlayId, "aria-labelledby": () => triggerId() }],
        ]}
      >
        {mode === "press" ? (
          <PressResponder {...triggerProps} onPress={() => toggleMenu(state)} ref={buttonRef} isPressed={() => state.isOpen()}>
            {children}
          </PressResponder>
        ) : (
          <HoverModeTrigger
            state={state}
            mode="focus"
            triggerProps={triggerProps}
            buttonRef={buttonRef}
            overlayId={initialOverlayId}
            triggerId={triggerId}
            idRef={overlayId}
          >
            {children}
          </HoverModeTrigger>
        )}
      </Provider>
    );
  }
  if (mode === "longPress") {
    // useMenuTrigger `trigger: 'longPress'`: a long press opens; a keyboard / virtual press toggles.
    const longPress = { props: { onLongPress: () => openOverlay(state) }, state: { timer: undefined, globals: [] } };
    const description = props.longPressAccessibilityDescription;
    const descriptionId = description ? resumedId() : undefined;
    return (
      <Provider
        values={[
          [OverlayTriggerStateContext, state],
          [DialogContext, { id: initialOverlayId, "aria-labelledby": () => triggerId(), idRef: overlayId }],
          [PopoverContext, { trigger: "DialogTrigger", triggerRef: buttonRef, id: initialOverlayId, "aria-labelledby": () => triggerId() }],
        ]}
      >
        <PressResponder
          {...triggerProps}
          aria-describedby={descriptionId}
          onPressStart={(e: PressEvent) => {
            if (e.pointerType === "mouse" || e.pointerType === "touch") longPressStart(longPress as never, e);
          }}
          onPressEnd={(e: PressEvent) => longPressEnd(longPress as never, e)}
          onPress={(e: PressEvent) => {
            if (e.pointerType !== "mouse" && e.pointerType !== "touch") toggleMenu(state);
          }}
          ref={buttonRef}
          isPressed={() => state.isOpen()}
        >
          {children}
        </PressResponder>
        {description ? (
          <span id={descriptionId} hidden>
            {description}
          </span>
        ) : null}
      </Provider>
    );
  }
  return (
    <HoverModeTrigger
      state={state}
      mode="hover"
      delay={timing.delay}
      closeDelay={timing.closeDelay}
      triggerProps={triggerProps}
      buttonRef={buttonRef}
      overlayId={initialOverlayId}
      triggerId={triggerId}
      idRef={overlayId}
    >
      {children}
    </HoverModeTrigger>
  );
}

/** `trigger="hover" | "focus"`: C1b's hover-trigger handlers (`../overlay/hover-trigger.tsx`) on the trigger and popover. */
function HoverModeTrigger(input: {
  state: MenuTriggerState;
  mode: "hover" | "focus";
  delay?: HoverTriggerProps["delay"];
  closeDelay?: HoverTriggerProps["closeDelay"];
  triggerProps: PressResponderProps;
  buttonRef: Ref<HTMLButtonElement>;
  overlayId: string;
  triggerId: Signal<string>;
  idRef: Signal<string>;
  children?: Content;
}) {
  const { state, mode, triggerProps, buttonRef, overlayId, triggerId, idRef } = input;
  const children = input.children;
  const overlayRef = createRef<HTMLElement>();
  const hover: HoverTriggerProps = { trigger: mode, delay: input.delay, closeDelay: input.closeDelay, triggerRef: buttonRef, overlayRef };
  const responderProps = {
    ...triggerProps,
    onPointerEnter: (e: PointerEvent) => {
      if (mode === "hover") hoverTriggerPointerEnter(e, hover, state);
    },
    onPointerLeave: (e: PointerEvent) => {
      if (mode === "hover") hoverTriggerPointerLeave(e, hover, state);
    },
    onFocus: (e: FocusEvent) => hoverTriggerFocus(e, hover, state),
    onBlur: (e: FocusEvent) => hoverTriggerBlur(e, hover, state),
    onPress: (e: PressEvent) => {
      // Hover mode: mouse / pen open by hovering; touch, keyboard and screen readers keep the press toggle.
      if (mode === "focus" || (e.pointerType !== "mouse" && e.pointerType !== "pen")) toggleMenu(state);
    },
  } as PressResponderProps;
  return (
    <Provider
      values={[
        [OverlayTriggerStateContext, state],
        [DialogContext, { id: overlayId, "aria-labelledby": () => triggerId(), idRef }],
        [
          PopoverContext,
          {
            trigger: "DialogTrigger",
            triggerRef: buttonRef,
            ref: overlayRef,
            id: overlayId,
            "aria-labelledby": () => triggerId(),
            onFocusWithin: () => hoverTriggerOverlayFocusWithin(state),
            onBlurWithin: (e: FocusEvent) => hoverTriggerOverlayBlurWithin(e, hover, state),
          },
        ],
      ]}
    >
      <PressResponder {...responderProps} ref={buttonRef} isPressed={() => state.isOpen()}>
        {children}
      </PressResponder>
      {/* Safe area while open (an own binding site: re-created alone on a resumed page). */}
      <span data-rv-overlay-anchor="" style={{ display: "contents" }}>
        <Show when={() => state.isOpen()}>{() => <HoverSafeArea hover={hover} state={state} />}</Show>
      </span>
    </Provider>
  );
}

function HoverSafeArea(input: { hover: HoverTriggerProps; state: MenuTriggerState }) {
  const { hover, state } = input;
  clientEffect(() => attachHoverTrigger(hover, state));
  return null;
}

const OWNED = ["style"] as const;
const SERVER = typeof document === "undefined";

/** A dialog is an overlay shown above other content in an application (RAC `Dialog`). */
export function Dialog(inProps: DialogProps) {
  const originalAriaLabelledby = inProps["aria-labelledby"];
  // RA mergeIds: a user id replaces the trigger's generated overlay id, so `aria-controls` follows it
  // (Rivet: the trigger's id signal travels in context, `idRef`; resumable, unlike mergeIds' browser map).
  const rawContext = useContext(DialogContext) as DialogContextValue | null;
  if (rawContext?.idRef && inProps.id) rawContext.idRef.set(inProps.id);
  // A server-open DialogTrigger's probe: the id merge above is all it needs.
  if (slotProbing) return null;
  const [merged, contextRef] = contextProps(inProps, inProps.ref, DialogContext);
  const { idRef: _idRef, ...props } = merged as DialogProps & { idRef?: unknown };
  if (rawContext?.idRef && inProps.id) props.id = inProps.id;
  const title = createSlotId();
  const content = createSlotId();
  const {
    dialogProps: d,
    titleProps,
    contentProps,
  } = dialogProps(
    {
      ...props,
      // Only pass aria-labelledby from props, not context.
      // Context is used as a fallback below.
      "aria-labelledby": originalAriaLabelledby,
      isEntering: undefined,
    },
    { title, content },
  );
  const state = useContext(OverlayTriggerStateContext);

  // If aria-labelledby exists on props (and not on the original props), it came from context: the fallback
  // when there is no title slot.
  const contextLabelledBy = props["aria-labelledby"] !== originalAriaLabelledby ? (props["aria-labelledby"] as MaybeAccessor<string | undefined>) : undefined;
  const ariaLabel = d["aria-label"];
  const labelledBy = () => (ariaLabel ? undefined : (d["aria-labelledby"]() ?? read(contextLabelledBy)));

  // One local arrow (R2: render props capture it), not `state ? f : g`.
  const close = () => {
    if (state) closeOverlay(state);
  };
  const rp = renderPropsOf(props, { defaultClassName: "rv-Dialog", values: { close } });

  // Client: an accessor, not `{rp.children()}`: Provider resolves its slot once (untracked), so plain text
  // children (`A {p()}`) would stay static; a function inside an array is inserted as a reactive binding (a
  // bare function child is a render prop: Provider would call it once).
  // Server: the children run inside the Provider's slot, which the server Provider calls while `body` is built —
  // before the `<section>` record reads aria-labelledby / -describedby — so the title / description parts have
  // marked their slot ids (an own `id` prop included: RA mergeIds). The traversal would call the accessor later,
  // after the open tag's attributes. Same work, same owner (the provide scope); the server inserts no binding
  // for a function child of a component either way.
  const childContent = () => rp.children();
  // Rivet (server): an alert dialog's `aria-describedby` names its description only when a part takes it (the content id
  // was kept by expectation: an IDREF to nothing without one) — probe which description part renders (`probeSlots`).
  if (SERVER && contentProps.id) probeSlots([[TextContext, { slots: { [DEFAULT_SLOT]: {}, description: { id: content } } }]], childContent);
  const body = (
    <Provider
      values={[
        [HeadingContext, { slots: { [DEFAULT_SLOT]: {}, title: { id: titleProps.id ? title : undefined, level: 2 } } }],
        [TextContext, { slots: { [DEFAULT_SLOT]: {}, description: { id: contentProps.id ? content : undefined } } }],
        [
          ButtonContext,
          {
            slots: {
              [DEFAULT_SLOT]: {},
              close: {
                onPress: () => {
                  if (state) closeOverlay(state);
                },
              },
            },
          },
        ],
      ]}
    >
      {SERVER ? childContent() : [childContent]}
    </Provider>
  );

  const element = createRef<HTMLElement>();
  const ref = mergeRefValues(element as RefValue<HTMLElement>, contextRef) as Ref<HTMLElement>;
  const isEntering = props.isEntering;
  // Rendered by the server: the mount effect runs on a resumed page when its chunk wakes (idle / visible).
  const resumed = typeof document === "undefined";
  // useDialog: focus the dialog itself on mount (or once it has entered), unless a child element is already focused.
  clientEffect(() => {
    const el = element();
    // Resumed page: the user already moved focus elsewhere (React focuses at hydration, before any interaction).
    if (resumed && el && !isFocusWithin(el) && focusMovedByUser(el.ownerDocument)) return;
    const entering = !!read(isEntering);
    // React focuses an `autoFocus` child on mount (commit, before useDialog's effect); a re-inserted Rivet
    // element only carries the `autofocus` attribute, which the browser ignores after page load.
    if (el && !entering && !isFocusWithin(el)) {
      const auto = el.querySelector<HTMLElement>("[autofocus]");
      if (auto) focusSafely(auto);
    }
    return dialogFocus(el, entering);
  });
  if (DEV) clientEffect(() => dialogTitleWarning(element()));

  const dom = globalDOMProps(props, OWNED);
  const id = d.id,
    role = d.role,
    ariaDetails = d["aria-details"],
    describedBy = d["aria-describedby"],
    slot = props.slot ?? undefined;
  if (props.render) {
    const attrs = {
      ...dom,
      id,
      slot,
      class: () => rp.class(),
      style: () => rp.style(),
      ref,
      role,
      tabindex: -1,
      "aria-label": ariaLabel,
      "aria-labelledby": () => labelledBy(),
      "aria-describedby": () => describedBy(),
      "aria-details": ariaDetails,
      onBlur: (event: FocusEvent) => dialogBlur(event as never),
      children: () => body,
    };
    return props.render(attrs as never, undefined);
  }
  return (
    <section
      {...dom}
      id={id}
      slot={slot}
      class={rp.class()}
      style={rp.style()}
      ref={ref}
      role={role}
      tabIndex={-1}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy()}
      aria-describedby={describedBy()}
      aria-details={ariaDetails}
      onBlur={(event) => dialogBlur(event)}
    >
      {body}
    </section>
  );
}
