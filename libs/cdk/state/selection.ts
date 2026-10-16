// Ported from @react-stately/selection (index): multiple selection + focus state and the
// SelectionManager. Implementation lives in @rivetjs/cdk/selection (shared with cdk behaviours);
// this module is the react-stately-shaped entry point (`@rivetjs/cdk/state/selection`).
export {
  createMultipleSelectionState,
  getSelection,
  readSelection,
  SelectionSet,
  setFocused,
  setFocusedKey,
  setSelectedKeys,
  setSelectionBehavior,
  type FocusState,
  type MultipleSelectionState,
  type MultipleSelectionStateProps,
} from "@rivetjs/cdk/selection/state";
export { SelectionManager, type MultipleSelectionManager, type SelectionManagerOptions, type SelectionEvent, type PointerType } from "@rivetjs/cdk/selection/manager";
export type { DisabledBehavior, FocusStrategy, Key, Selection, SelectionBehavior, SelectionMode } from "@rivetjs/cdk/collections/types";
