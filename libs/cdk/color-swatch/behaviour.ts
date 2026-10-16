// Ported from react-aria `useColorSwatch` (packages/react-aria/src/color/useColorSwatch.ts), Apache-2.0, © Adobe.
// Rivet: `useColorSwatch(props)` → `colorSwatchProps(props)` (RA's `{colorSwatchProps, color}`); `locale` is
// passed in (resolved at render); `useId(props.id)` → `createId()` when no id is given. Pure: no handlers.
import { createId } from "@rivetjs/cdk/id";
import { getStringsForLocale } from "@rivetjs/cdk/i18n";
import { parseColor, type Color } from "@rivetjs/cdk/color";
import { colorAriaMessages } from "../color/aria-intl.ts";

export interface AriaColorSwatchProps {
  /** The color value to display in the swatch. */
  color?: string | Color;
  /**
   * A localized accessible name for the color. By default, a description is generated from the color
   * value, but this can be overridden if you have a more specific color name (e.g. Pantone colors).
   */
  colorName?: string;
  /** The element's unique identifier. */
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
}

export interface ColorSwatchAria {
  /** Props for the color swatch element. */
  colorSwatchProps: {
    role: "img";
    "aria-roledescription": string;
    "aria-label": string;
    "aria-labelledby": string | undefined;
    "aria-describedby": string | undefined;
    "aria-details": string | undefined;
    id: string;
    style: { backgroundColor: string; forcedColorAdjust: "none" };
  };
  /** The parsed color value of the swatch. */
  color: Color;
}

/** The swatch color (`'#fff0'` — transparent — when none is given). */
export function colorSwatchColor(value: string | Color | undefined): Color {
  const nonNullValue = value || "#fff0";
  return typeof nonNullValue === "string" ? parseColor(nonNullValue) : nonNullValue;
}

/** react-aria `useColorSwatch`: attributes of the swatch element (role img, localized name, background). */
export function colorSwatchProps(props: AriaColorSwatchProps & { locale: string }): ColorSwatchAria {
  const color = colorSwatchColor(props.color);
  const { locale } = props;
  const strings = getStringsForLocale(colorAriaMessages, locale);
  const id = props.id || createId();
  let colorName = props.colorName;
  if (!colorName) {
    colorName = color.getChannelValue("alpha") === 0 ? strings.transparent : color.getColorName(locale);
  }
  return {
    colorSwatchProps: {
      role: "img",
      "aria-roledescription": strings.colorSwatch,
      "aria-label": [colorName, props["aria-label"] || ""].filter(Boolean).join(", "),
      "aria-labelledby": props["aria-labelledby"] ? `${id} ${props["aria-labelledby"]}` : undefined,
      "aria-describedby": props["aria-describedby"],
      "aria-details": props["aria-details"],
      id,
      style: { backgroundColor: color.toString("css"), forcedColorAdjust: "none" },
    },
    color,
  };
}
