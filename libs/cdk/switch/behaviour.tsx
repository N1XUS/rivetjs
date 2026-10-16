// Ported from react-aria `useSwitch` (packages/react-aria/src/switch/useSwitch.ts), Apache-2.0, © Adobe.
// Rivet: `useSwitch(props, state, ref)` → `switchProps(props, state, inputRef?)` over `toggleProps`
// (../checkbox/behaviour.tsx); bags hold accessors (`checked`), flags are accessors (`isSelected()`).
// `.tsx` (no JSX): the bags hold closures a resumed binding / context captures.
import type { ToggleState } from "../state/toggle.ts";
import { toggleProps, type AriaToggleProps, type InputRef, type ToggleAria } from "../checkbox/behaviour.tsx";

/** RA `AriaSwitchProps`. */
export interface AriaSwitchProps extends AriaToggleProps {}

/** RA `SwitchAria`. */
export type SwitchAria = ToggleAria;

/**
 * Provides the behavior and accessibility implementation for a switch component.
 * A switch is similar to a checkbox, but represents on/off values as opposed to selection.
 */
export function switchProps(props: AriaSwitchProps, state: ToggleState, inputRef?: InputRef): SwitchAria {
  const res = toggleProps(props, state, inputRef);
  return { ...res, inputProps: { ...res.inputProps, role: "switch", checked: () => state.selected() } };
}
