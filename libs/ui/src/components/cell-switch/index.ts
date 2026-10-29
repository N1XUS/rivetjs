// Rivet addition (no HeroUI v3.2.6 counterpart): settings-row switch; feature set inspired by commercial UI kits' public Cell Switch
// docs, independent implementation (see `cell-switch.tsx`).
import { CellSwitchControl, CellSwitchLabel, CellSwitchRoot, CellSwitchTrigger } from "./cell-switch.tsx";
import type { CellSwitchControlProps, CellSwitchLabelProps, CellSwitchRootProps, CellSwitchTriggerProps } from "./cell-switch.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const CellSwitch = Object.assign(CellSwitchRoot, {
  Root: CellSwitchRoot,
  Trigger: CellSwitchTrigger,
  Label: CellSwitchLabel,
  Control: CellSwitchControl,
});

export type CellSwitch = {
  Props: CellSwitchRootProps;
  RootProps: CellSwitchRootProps;
  TriggerProps: CellSwitchTriggerProps;
  LabelProps: CellSwitchLabelProps;
  ControlProps: CellSwitchControlProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { CellSwitchRoot, CellSwitchTrigger, CellSwitchLabel, CellSwitchControl } from "./cell-switch.tsx";
export type {
  CellSwitchRootProps,
  CellSwitchRootProps as CellSwitchProps,
  CellSwitchTriggerProps,
  CellSwitchLabelProps,
  CellSwitchControlProps,
} from "./cell-switch.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { cellSwitchVariants } from "../../../styles/src/components/cell-switch/index.ts";

export type { CellSwitchVariants } from "../../../styles/src/components/cell-switch/index.ts";
