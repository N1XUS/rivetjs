// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no morph). Feature set inspired by HeroUI Pro's public MorphButton
// docs (React Native: parts `CollapsedContent` / `ExpandedContent`, footprint = collapsed size, auto-measured sizes, eight
// logical directions (default `top`), variants `primary` (inverted) / `secondary`, controlled `isOpen` / `onOpenChange`,
// `defaultOpen`, `isDisabled`, `animation` off switch, content cross-fade + scale); independent web implementation,
// Rivet-authored styles on HeroUI tokens.
// - Behaviour + motion = `@rivetjs/cdk/morph` (house motion on `@rivetjs/cdk/motion`): the press handlers call
//   `openMorph` / `closeMorph` with the event target (the root is found from it), so nothing runs before the first press.
//   The controller owns `data-open` on the root, `inert` on both contents and `aria-expanded` on the trigger after that;
//   the server renders their initial values from the state (untracked: no binding), so a `defaultOpen` page is correct
//   with no script. A controlled `isOpen` (Signal / accessor) is followed by a `clientEffect` (only then).
// - Web additions: `Morph.Trigger` (the collapsed state's button: keyboard + focus target on close; a press anywhere on the
//   collapsed content opens too), `Morph.Close` (a ui Button that collapses), `useMorph()` (open / close / toggle / isOpen),
//   panel `role="dialog"` (named by `aria-label` on ExpandedContent), focus into the panel on open, Escape / outside press
//   / focus leaving close it, focus back to the trigger.
// - Root carries `preload="visible"` (cdk first-interaction rule): the press handler chunk is fetched while visible, so a
//   cold press morphs at once; nothing runs at load.
import { ButtonRoot } from "../button/index.ts";
import type { ButtonRootProps } from "../button/index.ts";
import { createId } from "@rivetjs/cdk/id";
import { closeMorph, createMorphState, openMorph, syncMorph, toggleMorph } from "@rivetjs/cdk/morph";
import type { MorphDirection, MorphMotionOptions, MorphState, MorphStateProps } from "@rivetjs/cdk/morph";
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { Provider, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";

import type { MorphVariants } from "../../../styles/src/components/morph/index.ts";
import { morphVariants } from "../../../styles/src/components/morph/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Morph Context
 * -----------------------------------------------------------------------------------------------*/
interface MorphContext {
  /** Set inside a Morph. */
  inMorph?: true;
  state?: MorphState;
  id?: string;
  direction?: MorphDirection;
  variant?: MorphVariants["variant"];
  motion?: MorphMotionOptions;
}

const MorphContext = resumableContext(createContext<MorphContext>({}, { id: "rv-ui-morph" }));

type MorphSlots = ReturnType<typeof morphVariants>;

/** Module-level memo per direction × variant (tv slot functions are pure). */
const SLOTS: Record<string, MorphSlots> = {};
const slotsFor = (direction: MorphDirection = "top", variant: MorphVariants["variant"] = "primary"): MorphSlots =>
  (SLOTS[`${direction}|${variant}`] ??= morphVariants({ direction, variant }));
const slotsOf = (context: MorphContext): MorphSlots | undefined => (context.inMorph ? slotsFor(context.direction, context.variant) : undefined);

/* -------------------------------------------------------------------------------------------------
 * Morph Root
 * -----------------------------------------------------------------------------------------------*/
type MorphAnimation = boolean | "disabled" | "disable-all" | MorphMotionOptions;

interface MorphRootProps extends MorphStateProps, Omit<JSX.IntrinsicElements["div"], "children" | "class">, Omit<MorphVariants, "direction"> {
  /**
   * Logical direction the surface grows toward (the opposite side stays pinned to the collapsed box).
   *
   * @default "top"
   */
  direction?: MorphDirection;
  /**
   * Motion: `false` / `"disabled"` / `"disable-all"` jump between the states; an object tunes the house motion
   * (`duration`, `friction`, embla units).
   */
  animation?: MorphAnimation;
  class?: string;
  children?: Content;
}

const MorphRoot = (props: MorphRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, [
    "children",
    "class",
    "direction",
    "variant",
    "animation",
    "isOpen",
    "defaultOpen",
    "onOpenChange",
    "isDisabled",
    "id",
  ]);
  const state = createMorphState({ isOpen: local.isOpen, defaultOpen: local.defaultOpen, onOpenChange: local.onOpenChange, isDisabled: local.isDisabled });
  const id = local.id ?? createId();
  const direction = local.direction ?? "top";
  const variant = local.variant ?? "primary";
  const animation = local.animation;
  const disabled = animation === false || animation === "disabled" || animation === "disable-all";
  const motion: MorphMotionOptions | undefined = typeof animation === "object" ? { duration: animation.duration, friction: animation.friction } : undefined;
  const value: MorphContext = { inMorph: true, state, id, direction, variant, motion };
  const initiallyOpen = untrack(state.open.value) === true;
  const rootRef = createRef<HTMLDivElement>();

  // A controlled open state may change outside the morph's own handlers: follow it (the handlers already synced).
  if (local.isOpen !== undefined)
    clientEffect(() => {
      const open = state.open.value() === true;
      const root = rootRef();
      if (root) syncMorph(state, root, open, motion);
    });

  return (
    <Provider token={MorphContext} value={value}>
      <div
        ref={rootRef}
        id={id}
        class={slotsFor(direction, variant).base({ class: local.class })}
        data-slot="morph"
        data-morph-root=""
        data-direction={direction}
        data-open={initiallyOpen ? "" : undefined}
        data-disabled={state.isDisabled ? "true" : undefined}
        data-animation={disabled ? "disabled" : undefined}
        preload="visible"
        {...rest}
      >
        {local.children}
      </div>
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CollapsedContent
 * -----------------------------------------------------------------------------------------------*/
interface MorphCollapsedContentProps extends Omit<JSX.IntrinsicElements["div"], "children" | "class"> {
  class?: string;
  children?: Content;
}

const MorphCollapsedContent = (props: MorphCollapsedContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(MorphContext);
  const state = context.state;
  const motion = context.motion;
  const initiallyOpen = state ? untrack(state.open.value) === true : false;
  return (
    <div
      class={composeSlotClassName(slotsOf(context)?.collapsed, local.class)}
      data-slot="morph-collapsed"
      data-morph-collapsed=""
      inert={initiallyOpen ? true : undefined}
      onClick={(e) => {
        if (state) openMorph(state, e.currentTarget as Element, motion);
      }}
      {...rest}
    >
      {local.children}
    </div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ExpandedContent (+ the morphing surface around it)
 * -----------------------------------------------------------------------------------------------*/
interface MorphExpandedContentProps extends Omit<JSX.IntrinsicElements["div"], "children" | "class"> {
  /** Accessible name of the panel (`role="dialog"`). */
  "aria-label"?: string;
  /** Classes of the panel (set its width here, e.g. `w-80`). */
  class?: string;
  /** Classes of the morphing surface around the panel. */
  surfaceClass?: string;
  children?: Content;
}

const MorphExpandedContent = (props: MorphExpandedContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "surfaceClass"]);
  const context = useContext(MorphContext);
  const slots = slotsOf(context);
  const initiallyOpen = context.state ? untrack(context.state.open.value) === true : false;
  return (
    <div class={composeSlotClassName(slots?.surface, local.surfaceClass)} data-slot="morph-surface" data-morph-surface="">
      <div
        id={context.id ? `${context.id}-panel` : undefined}
        class={composeSlotClassName(slots?.expanded, local.class)}
        data-slot="morph-expanded"
        data-morph-expanded=""
        role="dialog"
        tabIndex={-1}
        inert={initiallyOpen ? undefined : true}
        {...rest}
      >
        {local.children}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Trigger
 * -----------------------------------------------------------------------------------------------*/
interface MorphTriggerProps extends Omit<JSX.IntrinsicElements["button"], "children" | "class"> {
  class?: string;
  children?: Content;
}

/** The collapsed state's button: opens the morph (the press bubbles to the collapsed content) and gets focus back on close. */
const MorphTrigger = (props: MorphTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(MorphContext);
  const initiallyOpen = context.state ? untrack(context.state.open.value) === true : false;
  return (
    <button
      type="button"
      class={composeSlotClassName(slotsOf(context)?.trigger, local.class)}
      data-slot="morph-trigger"
      data-morph-trigger=""
      aria-expanded={initiallyOpen ? "true" : "false"}
      aria-controls={context.id ? `${context.id}-panel` : undefined}
      disabled={context.state?.isDisabled ? true : undefined}
      {...rest}
    >
      {local.children}
    </button>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Close
 * -----------------------------------------------------------------------------------------------*/
type MorphCloseProps = ButtonRootProps;

/** A ui Button inside the panel that collapses the morph (then runs its own `onPress`). */
const MorphClose = (props: MorphCloseProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["onPress", "class"]);
  const context = useContext(MorphContext);
  const state = context.state;
  const motion = context.motion;
  const onPress = local.onPress;
  return (
    <ButtonRoot
      data-slot="morph-close"
      class={composeSlotClassName(slotsOf(context)?.close, local.class as string | undefined) as never}
      {...(rest as object)}
      onPress={(e) => {
        if (state) closeMorph(state, e.target, motion);
        onPress?.(e);
      }}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * useMorph
 * -----------------------------------------------------------------------------------------------*/
interface UseMorphReturn {
  /** Whether the morph is open (tracked). */
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/** Morph state + actions inside a Morph (the actions find the root by its id). */
function useMorph(): UseMorphReturn {
  const context = useContext(MorphContext);
  const state = context.state;
  const id = context.id;
  const motion = context.motion;
  return {
    isOpen: () => (state ? state.open.value() === true : false),
    open: () => {
      if (state) openMorph(state, id ? document.getElementById(id) : null, motion);
    },
    close: () => {
      if (state) closeMorph(state, id ? document.getElementById(id) : null, motion);
    },
    toggle: () => {
      if (state) toggleMorph(state, id ? document.getElementById(id) : null, motion);
    },
  };
}

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { MorphRoot, MorphCollapsedContent, MorphExpandedContent, MorphTrigger, MorphClose, MorphContext, useMorph };
export type {
  MorphRootProps,
  MorphCollapsedContentProps,
  MorphExpandedContentProps,
  MorphTriggerProps,
  MorphCloseProps,
  MorphAnimation,
  UseMorphReturn,
  MorphDirection,
};
