// A visually hidden button that lets screen reader users dismiss a popup without a visible close
// affordance (React Aria `DismissButton`): place one at the start and end of a popover. Label:
// localized "Dismiss" (`locale`, default the document language / en-US) unless `aria-label` /
// `aria-labelledby` is given. Hidden by inline styles (no stylesheet needed).
//
// Ported from @react-aria/overlays (DismissButton.tsx), Apache-2.0, © Adobe.
import { dismissLabel } from "./overlay-strings.ts";
import { visuallyHidden } from "../a11y/index.ts";

export interface DismissButtonProps {
  /** Called when the button is activated. */
  onDismiss?: () => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  id?: string;
  /** Locale of the default label. @default "en-US" on the server */
  locale?: string;
}

export function DismissButton(props: DismissButtonProps) {
  const onDismiss = props.onDismiss;
  // useLabels: aria-labelledby alone keeps no default label; with both, the button labels itself too.
  const labelledBy = props["aria-labelledby"];
  const label = props["aria-label"] ?? (labelledBy ? undefined : dismissLabel(props.locale));
  const id = props.id;
  return (
    <div style={visuallyHidden}>
      <button
        type="button"
        id={id}
        aria-label={label}
        aria-labelledby={labelledBy && props["aria-label"] && id ? `${id} ${labelledBy}` : labelledBy}
        tabIndex={-1}
        onClick={() => onDismiss?.()}
      ></button>
    </div>
  );
}
