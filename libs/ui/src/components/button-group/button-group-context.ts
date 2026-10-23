// Ported from HeroUI v3.2.6 packages/react/src/components/button-group/button-group.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ButtonGroupContext` / `BUTTON_GROUP_CHILD` in their own module (upstream: `button-group.tsx`) so `Button` imports them
// without pulling in cdk `Group`.
// - The context carries data `{ size, variant, isDisabled, fullWidth, orientation }` instead of the tv `slots` (functions do not
//   serialize on resume); `ButtonGroup.Separator` looks its slots up from `fullWidth` / `orientation` (module-level memo).
//   `orientation` is Rivet-only (it picks the separator slots; set only inside a `ButtonGroup`). Resumable token
//   `rv-ui-button-group`, default `{}`. Fields are getters over the group's props when one of them is live.
// - `BUTTON_GROUP_CHILD`: upstream clones the group's direct children with `{ [BUTTON_GROUP_CHILD]: true }` and `Button` reads
//   the context only then. Rivet JSX has no element clone (`Children`): every `Button` under a `ButtonGroup` reads it;
//   `{ [BUTTON_GROUP_CHILD]: false }` opts a `Button` out.
import { createContext } from "@rivetjs/reactivity";

import type { ButtonVariants } from "../../../styles/src/components/button/index.ts";

/* -------------------------------------------------------------------------------------------------
 * ButtonGroup Context
 * -----------------------------------------------------------------------------------------------*/
interface ButtonGroupContext {
  size?: ButtonVariants["size"];
  variant?: ButtonVariants["variant"];
  isDisabled?: boolean;
  fullWidth?: ButtonVariants["fullWidth"];
  orientation?: "horizontal" | "vertical";
}

const ButtonGroupContext = createContext<ButtonGroupContext>({});

// Property name to mark direct children of ButtonGroup
const BUTTON_GROUP_CHILD = "__button_group_child";

export { ButtonGroupContext, BUTTON_GROUP_CHILD };
