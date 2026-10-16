// Ported from react-aria useSeparator (packages/react-aria/src/separator/useSeparator.ts), Apache-2.0, © Adobe.
// Rivet: `useSeparator(props)` → `separatorProps(props)` returning RA's result `{ separatorProps }` (naming
// convention: RA result object, RA keys). `filterDOMProps(props, { labelable: true })` → `id` + aria labels.
import type { AriaLabelingProps, DOMProps, Orientation } from "../utils/types.ts";

export interface AriaSeparatorProps extends DOMProps, AriaLabelingProps {
  /**
   * The orientation of the separator.
   *
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /** The HTML element type that will be used to render the separator. */
  elementType?: string;
}

const LABELABLE = ["id", "aria-label", "aria-labelledby", "aria-describedby", "aria-details"] as const;

export interface SeparatorAria {
  /** Props for the separator element. */
  separatorProps: Record<string, unknown>;
}

/** Accessibility attributes of a separator (RA `useSeparator`). */
export function separatorProps(props: AriaSeparatorProps): SeparatorAria {
  const domProps: Record<string, unknown> = {};
  for (const key of LABELABLE) if (props[key] !== undefined) domProps[key] = props[key];
  let ariaOrientation: "vertical" | undefined;
  // If orientation is horizontal, aria-orientation default is horizontal, so we leave it undefined;
  // if it's vertical, we need to specify it.
  if (props.orientation === "vertical") ariaOrientation = "vertical";
  // hr elements implicitly have role = separator and a horizontal orientation.
  if (props.elementType !== "hr") return { separatorProps: { ...domProps, role: "separator", "aria-orientation": ariaOrientation } };
  return { separatorProps: domProps };
}
