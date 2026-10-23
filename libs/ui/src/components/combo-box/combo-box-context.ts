// Ported from HeroUI v3.2.6 packages/react/src/components/combo-box/combo-box.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComboBoxContext` in its own module (upstream: `combo-box.tsx`) so `Input` reads the variant fallback without pulling in
// the cdk ComboBox.
// - The context carries data `{ inComboBox, fullWidth, variant }` instead of `{ slots, variant }` (tv slot functions do not serialize
//   on resume); parts look their slots up from `fullWidth` (module-level memo). Resumable token `rv-ui-combo-box`, default `{}`.
//   Fields are getters over the root's props when one of them is live.
import { createContext } from "@rivetjs/reactivity";

import type { ComboBoxVariants } from "../../../styles/src/components/combo-box/index.ts";

/* -------------------------------------------------------------------------------------------------
 * ComboBox Context
 * -----------------------------------------------------------------------------------------------*/
type ComboBoxContext = {
  /** Rivet: set by `ComboBox` (upstream: `slots`). */
  inComboBox?: boolean;
  fullWidth?: ComboBoxVariants["fullWidth"];
  variant?: "primary" | "secondary";
};

const ComboBoxContext = createContext<ComboBoxContext>({});

export { ComboBoxContext };
export type { ComboBoxContext as ComboBoxContextValue };
