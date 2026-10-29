// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no cell switch). Feature set inspired by commercial UI kits' public Cell Switch
// docs (a settings row: label start, switch end, the whole row toggles; variants default / secondary; parts `.Trigger`,
// `.Label`, `.Control`); independent implementation, Rivet-authored styles on HeroUI tokens.
// - Root = ui `Switch` (cdk `SwitchField`: isSelected value or two-way Signal / defaultSelected / onChange / isDisabled / name /
//   value / form validation); `.Trigger` = `Switch.Content` (the cdk `SwitchButton` label: a press anywhere in the row toggles);
//   `.Control` = `Switch.Control` with a default `Switch.Thumb`; `.Label` = a span (title + description column).
// - Context `rv-ui-cell-switch` `{ inCell, variant }` (a getter when `variant` is live) picks the part classes.
// - Shorthand (identity spec §4.2): no children = Trigger(Label(`label`, `description`), Control).
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { CellSwitchVariants } from "../../../styles/src/components/cell-switch/index.ts";
import { cellSwitchVariants } from "../../../styles/src/components/cell-switch/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { SwitchContent, SwitchControl, SwitchRoot, SwitchThumb } from "../switch/switch.tsx";
import type { SwitchContentProps, SwitchControlSpanProps, SwitchRootProps } from "../switch/switch.tsx";

interface CellSwitchContext {
  inCell?: true;
  variant?: CellSwitchVariants["variant"];
}

const CellSwitchContext = createContext<CellSwitchContext>({});

type CellSwitchSlots = ReturnType<typeof cellSwitchVariants>;
const SLOTS: Record<string, CellSwitchSlots> = {};
const slotsFor = (variant: CellSwitchVariants["variant"]): CellSwitchSlots => (SLOTS[String(variant)] ??= cellSwitchVariants({ variant }));
const slotsOf = (context: CellSwitchContext): CellSwitchSlots | undefined => (context.inCell ? slotsFor(context.variant) : undefined);

/* -------------------------------------------------------------------------------------------------
 * CellSwitch Root
 * -----------------------------------------------------------------------------------------------*/
interface CellSwitchRootProps extends Omit<SwitchRootProps, "label" | "description" | "size">, CellSwitchVariants {
  /** Shorthand (no children): the row's label. */
  label?: Content;
  /** Shorthand (no children): a muted line under the label. */
  description?: Content;
}

const CellSwitchRoot = (props: CellSwitchRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "description", "label", "variant"]);
  const contextValue: CellSwitchContext = {
    inCell: true,
    get variant() {
      return local.variant;
    },
  };
  const children = local.children;
  const label = local.label;
  const description = local.description;
  // A function: Rivet JSX builds nodes eagerly, the switch must be created inside the provider.
  const content = () => (
    <SwitchRoot {...(rest as SwitchRootProps)} class={slotsFor(local.variant).base({ class: local.class as string | undefined })}>
      {children === undefined ? (
        <CellSwitchTrigger>
          <CellSwitchLabel>
            {label}
            {description !== undefined && (
              <span class={slotsFor(local.variant).description()} data-slot="cell-switch-description">
                {description}
              </span>
            )}
          </CellSwitchLabel>
          <CellSwitchControl />
        </CellSwitchTrigger>
      ) : (
        children
      )}
    </SwitchRoot>
  );
  return (
    <Provider token={CellSwitchContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CellSwitch Trigger — the row (`Switch.Content`, a label: a press anywhere toggles)
 * -----------------------------------------------------------------------------------------------*/
interface CellSwitchTriggerProps extends SwitchContentProps {}

const CellSwitchTrigger = (props: CellSwitchTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CellSwitchContext);
  return (
    <SwitchContent {...rest} class={composeSlotClassName(slotsOf(context)?.trigger, local.class as string | undefined)}>
      {local.children}
    </SwitchContent>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CellSwitch Label — leading text (span)
 * -----------------------------------------------------------------------------------------------*/
type CellSwitchLabelProps = Omit<JSX.IntrinsicElements["span"], "class"> & { class?: string };

const CellSwitchLabel = (props: CellSwitchLabelProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CellSwitchContext);
  return (
    <span class={composeSlotClassName(slotsOf(context)?.label, local.class)} data-slot="cell-switch-label" {...rest}>
      {local.children}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CellSwitch Control — `Switch.Control` with a default `Switch.Thumb`
 * -----------------------------------------------------------------------------------------------*/
type CellSwitchControlProps = SwitchControlSpanProps;

const CellSwitchControl = (props: CellSwitchControlProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CellSwitchContext);
  const children = (): Content => (local.children === undefined ? <SwitchThumb /> : local.children);
  return (
    <SwitchControl {...rest} class={composeSlotClassName(slotsOf(context)?.control, local.class)}>
      {children()}
    </SwitchControl>
  );
};

export { CellSwitchRoot, CellSwitchTrigger, CellSwitchLabel, CellSwitchControl, CellSwitchContext };
export type { CellSwitchRootProps, CellSwitchTriggerProps, CellSwitchLabelProps, CellSwitchControlProps };
