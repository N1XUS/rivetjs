import type { JSX } from "@rivetjs/runtime/jsx-runtime";
// Target twin (the compiler rewrites `@rivetjs/runtime/dom` to the server entry on the server target).
import { _svgShapes } from "@rivetjs/runtime/dom";

/** lucide icon data (`import { Check } from "lucide"`): `[tag, attributes]` per shape. */
export type IconNode = readonly (readonly [tag: string, attrs: Readonly<Record<string, string | number | undefined>>])[];

/** Props of `<Icon>`: lucide icon data, size, colour, stroke width, plus any `<svg>` attribute. */
export type IconProps = Omit<JSX.IntrinsicElements["svg"], "children" | "color"> & {
  /** lucide icon data: `import { Check } from "lucide"` (per-icon ES module: unused icons tree-shake to 0 B). */
  icon: IconNode;
  /** Width and height in px (default 24). */
  size?: number | string;
  /** Stroke colour (default `currentColor`). */
  color?: string;
  /** Default 2 (lucide units on the 24 × 24 grid). */
  strokeWidth?: number | string;
  /** Keep the stroke `strokeWidth` px wide whatever `size` is (lucide `absoluteStrokeWidth`). */
  absoluteStrokeWidth?: boolean;
  /** Accessible name: `<title>` + `role="img"`. Without it (or `aria-label` / `aria-labelledby`) the icon is `aria-hidden`. */
  title?: string;
};

const OWN = new Set(["icon", "size", "color", "strokeWidth", "absoluteStrokeWidth", "title", "children"]);
// Brand of the runtime's Proxy-backed props (`@rivetjs/runtime/props`): their keys can change after creation.
const PROXY = Symbol.for("rivet.props");
const strokeWidth = (props: IconProps): number | string => {
  const stroke = props.strokeWidth ?? 2;
  return props.absoluteStrokeWidth ? (Number(stroke) * 24) / Number(props.size ?? 24) : stroke;
};
/** Root attributes: lucide defaults, then the caller's svg attributes (`class`, `style`, `aria-*`, …). */
function root(props: IconProps): Record<string, unknown> {
  const size = props.size ?? 24,
    labelled = props.title || props["aria-label"] || props["aria-labelledby"];
  const out: Record<string, unknown> = {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: props.color ?? "currentColor",
    "stroke-width": strokeWidth(props),
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": labelled ? undefined : "true",
    role: labelled ? "img" : undefined,
  };
  for (const key in props) if (!OWN.has(key)) out[key] = (props as Record<string, unknown>)[key];
  return out;
}
const FIXED = 0,
  STATIC = 1,
  LIVE = 2,
  SPREAD = 3;
/**
 * How the root renders. SPREAD: other svg attributes (or Proxy-backed props, whose keys can change) → one
 * spread of the merged attributes. Else explicit attributes: LIVE when `title` is given or a root prop is a
 * getter (live props: one binding per attribute); STATIC when only `icon` is a getter (root written once, the
 * shapes a binding); FIXED when nothing is (root and shapes written once: no binding at all).
 */
function mode(props: IconProps): number {
  if ((props as Record<symbol, unknown>)[PROXY] === 1) return SPREAD;
  let out = FIXED;
  for (const key in props) {
    if (key !== "class" && !OWN.has(key)) return SPREAD;
    if (out === LIVE || key === "children") continue;
    if (key === "title") out = LIVE;
    else if (Object.getOwnPropertyDescriptor(props, key)?.get) out = key === "icon" ? STATIC : LIVE;
  }
  return out;
}

/**
 * A lucide icon as inline SVG (server + client, resumable at zero JS with constant props):
 * `<Icon icon={Check} size={16} class="ok" />`. Decorative (`aria-hidden`) unless `title` / `aria-label` is set.
 * The one way to draw an icon: never hand-write SVG paths or use UTF symbols as icons (lucide only).
 * The shapes are one cached template per icon data array (`_svgShapes`: a clone in the browser, one pre-escaped
 * chunk on the server); a changed `icon` re-creates them. The root is written once for constant props (no
 * binding at all when `icon` is constant too), bound per attribute for live ones (getters, `title`), or spread
 * when other svg attributes are passed (`mode`; same markup in every mode).
 */
export function Icon(props: IconProps) {
  const how = mode(props);
  if (how <= STATIC) {
    const size = props.size ?? 24,
      stroke = props.color ?? "currentColor",
      width = strokeWidth(props),
      cls = props.class;
    if (how === FIXED) {
      const shapes = _svgShapes(props.icon);
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={stroke}
          stroke-width={width}
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class={cls}
        >
          {shapes}
        </svg>
      );
    }
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        stroke-width={width}
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class={cls}
      >
        {_svgShapes(props.icon)}
      </svg>
    );
  }
  if (how === LIVE)
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={props.size ?? 24}
        height={props.size ?? 24}
        viewBox="0 0 24 24"
        fill="none"
        stroke={props.color ?? "currentColor"}
        stroke-width={strokeWidth(props)}
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden={props.title ? undefined : "true"}
        role={props.title ? "img" : undefined}
        class={props.class}
      >
        {props.title ? <title>{props.title}</title> : null}
        {_svgShapes(props.icon)}
      </svg>
    );
  return (
    <svg {...root(props)}>
      {props.title ? <title>{props.title}</title> : null}
      {_svgShapes(props.icon)}
    </svg>
  );
}
