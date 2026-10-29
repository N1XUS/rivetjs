// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no action bar). Feature set (parts `ActionBar` / `Prefix` / `Content`
// / `Suffix`, props `isOpen` / `aria-label` "Actions" / `isAttached` true / `orientation`, classes `action-bar*`, responsive
// labels) scoped from public docs of commercial UI kits; independent implementation, Rivet-authored styles on HeroUI tokens.
// - Selection-agnostic: the bar knows nothing about a collection; `isOpen` (a value, a live prop or an accessor) shows it,
//   the caller renders the count / actions (DataGrid, Table, ListBox, ListView …).
// - Root = fixed bottom-centre `div.action-bar` (`data-open`, pointer events only on the pill) around a ui `Toolbar`
//   (`role="toolbar"`, `aria-label`, `aria-orientation`, arrow-key focus between the actions; `isAttached` = the vendored
//   pill look). Both are always server-rendered: open / close is the `data-open` attribute binding, enter / exit are CSS
//   transitions (`@starting-style` + `display` allow-discrete), none with reduced motion — no JS presence, no client
//   effect, nothing boots at load.
// - Opening is announced (React Spectrum ActionBar: `announce("Actions available.")` on open): an always-mounted,
//   visually hidden polite live region (`data-slot="action-bar-announcer"`, outside the `display: none` pill, so it is in
//   the accessibility tree while closed) whose text binding switches from "" to `announcement` when the bar opens — a
//   binding on the open accessor, no client effect (UI-COLD 2026-10-08: the region used to be only the Prefix, inside the
//   hidden pill, so the opening itself was never announced).
// - `Prefix` is a polite live region (`aria-live="polite"`, `aria-atomic`): a selection count rendered there is announced
//   when it changes while the bar is open.
// - Context `rv-ui-action-bar` (plain `{ inActionBar, orientation }`); slots from a module memo per orientation.
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { visuallyHidden } from "@rivetjs/cdk/a11y";

import type { ActionBarVariants } from "../../../styles/src/components/action-bar/index.ts";
import { actionBarVariants } from "../../../styles/src/components/action-bar/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { accessorIfLive, splitLive } from "../../utils/live.tsx";
import { ToolbarRoot } from "../toolbar/index.ts";

/* -------------------------------------------------------------------------------------------------
 * ActionBar Context
 * -----------------------------------------------------------------------------------------------*/
type ActionBarOrientation = "horizontal" | "vertical";

interface ActionBarContext {
  /** Set inside an ActionBar. */
  inActionBar?: true;
  orientation?: ActionBarOrientation;
}

const ActionBarContext = createContext<ActionBarContext>({});

type ActionBarSlots = ReturnType<typeof actionBarVariants>;

/** Module-level memo per orientation (tv slot functions are pure). */
const SLOTS: Partial<Record<ActionBarOrientation, ActionBarSlots>> = {};
const slotsFor = (orientation: ActionBarOrientation): ActionBarSlots => (SLOTS[orientation] ??= actionBarVariants({ orientation }));

/** `undefined` outside an ActionBar. */
const slotsOf = (context: ActionBarContext): ActionBarSlots | undefined => (context.inActionBar ? slotsFor(context.orientation ?? "horizontal") : undefined);

/* -------------------------------------------------------------------------------------------------
 * ActionBar Root
 * -----------------------------------------------------------------------------------------------*/
interface ActionBarRootProps extends Omit<JSX.IntrinsicElements["div"], "children" | "class">, Omit<ActionBarVariants, "orientation"> {
  /** Whether the bar is shown (a value, a live prop `isOpen={count() > 0}` or an accessor). */
  isOpen: boolean | (() => boolean);
  /**
   * Accessible name of the toolbar.
   *
   * @default "Actions"
   */
  "aria-label"?: string;
  /**
   * Pill surface around the actions (the attached toolbar look).
   *
   * @default true
   */
  isAttached?: boolean;
  /**
   * Layout of the sections (read once: picks the toolbar's arrow keys).
   *
   * @default "horizontal"
   */
  orientation?: ActionBarOrientation;
  /**
   * Message the polite live region announces when the bar opens (React Spectrum ActionBar `actionsAvailable`).
   *
   * @default "Actions available."
   */
  announcement?: string;
  /** Classes of the fixed outer layer (`action-bar`). */
  class?: string;
  children?: Content;
}

const ActionBarRoot = (props: ActionBarRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "isOpen", "aria-label", "isAttached", "orientation", "announcement"]);
  const announcement = local.announcement ?? "Actions available.";
  const orientation = local.orientation ?? "horizontal";
  const value: ActionBarContext = { inActionBar: true, orientation };
  const wrapperClass = slotsFor(orientation).wrapper();
  const open = accessorIfLive(local, "isOpen");
  const content = () => (
    <div
      class={slotsFor(orientation).base({ class: local.class })}
      data-slot="action-bar"
      data-orientation={orientation}
      data-open={() => {
        // `open` = the value, the caller's accessor or (live prop) a resumable accessor over it (this arrow is a resumable
        // symbol: capture only serializable values; class strings come from the module memo, never a captured tv object).
        let value: unknown = open;
        while (typeof value === "function") value = (value as () => unknown)();
        return value ? "true" : undefined;
      }}
      {...rest}
    >
      <span data-slot="action-bar-announcer" aria-live="polite" aria-atomic="true" style={visuallyHidden}>
        {() => {
          let value: unknown = open;
          while (typeof value === "function") value = (value as () => unknown)();
          return value ? announcement : "";
        }}
      </span>
      <ToolbarRoot
        class={wrapperClass}
        data-slot="action-bar-wrapper"
        aria-label={local["aria-label"] ?? "Actions"}
        isAttached={local.isAttached ?? true}
        orientation={orientation}
      >
        {local.children}
      </ToolbarRoot>
    </div>
  );

  return (
    <Provider token={ActionBarContext} value={value}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Prefix / Content / Suffix
 * -----------------------------------------------------------------------------------------------*/
interface ActionBarPartProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** Part props for the default element (`div`). */
type ActionBarPartDivProps = ActionBarPartProps & Omit<JSX.IntrinsicElements["div"], keyof ActionBarPartProps>;
type ActionBarPrefixProps = ActionBarPartDivProps;
type ActionBarContentProps = ActionBarPartDivProps;
type ActionBarSuffixProps = ActionBarPartDivProps;

const ActionBarPrefix = (props: ActionBarPrefixProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ActionBarContext);
  return (
    <dom.div
      class={composeSlotClassName(slotsOf(context)?.prefix, local.class)}
      data-slot="action-bar-prefix"
      aria-live="polite"
      aria-atomic="true"
      {...(rest as ActionBarPartDivProps)}
    >
      {local.children}
    </dom.div>
  );
};

const ActionBarContent = (props: ActionBarContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ActionBarContext);
  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.content, local.class)} data-slot="action-bar-content" {...(rest as ActionBarPartDivProps)}>
      {local.children}
    </dom.div>
  );
};

const ActionBarSuffix = (props: ActionBarSuffixProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ActionBarContext);
  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.suffix, local.class)} data-slot="action-bar-suffix" {...(rest as ActionBarPartDivProps)}>
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ActionBarRoot, ActionBarPrefix, ActionBarContent, ActionBarSuffix, ActionBarContext };
export type { ActionBarRootProps, ActionBarPrefixProps, ActionBarContentProps, ActionBarSuffixProps, ActionBarPartDivProps, ActionBarOrientation };
