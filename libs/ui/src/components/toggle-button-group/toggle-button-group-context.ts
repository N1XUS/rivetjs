// Ported from HeroUI v3.2.6 packages/react/src/components/toggle-button-group/toggle-button-group.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ToggleButtonGroupContext` / `TOGGLE_BUTTON_GROUP_CHILD` in their own module (upstream: `toggle-button-group.tsx`) so
// `ToggleButton` imports them without pulling in cdk `ToggleButtonGroup`.
// - Data `{ size, isDisabled, fullWidth, isDetached, orientation }` instead of the tv `slots` (functions do not serialize on resume);
//   `ToggleButtonGroup.Separator` looks its slots up from `fullWidth` / `isDetached` / `orientation` (Rivet-only fields, set only
//   inside a `ToggleButtonGroup`; module-level memo). Resumable token `rv-ui-toggle-button-group`, default `{}`. Fields are
//   getters over the group's props when one of them is live.
import { createContext } from "@rivetjs/reactivity";

import type { ToggleButtonVariants } from "../../../styles/src/components/toggle-button/index.ts";

/* -------------------------------------------------------------------------------------------------
 * ToggleButtonGroup Context
 * -----------------------------------------------------------------------------------------------*/
interface ToggleButtonGroupContext {
  size?: ToggleButtonVariants["size"];
  isDisabled?: boolean;
  fullWidth?: boolean;
  isDetached?: boolean;
  orientation?: "horizontal" | "vertical";
}

const ToggleButtonGroupContext = createContext<ToggleButtonGroupContext>({});

// Property name to mark direct children of ToggleButtonGroup
const TOGGLE_BUTTON_GROUP_CHILD = "__toggle_button_group_child";

export { ToggleButtonGroupContext, TOGGLE_BUTTON_GROUP_CHILD };
