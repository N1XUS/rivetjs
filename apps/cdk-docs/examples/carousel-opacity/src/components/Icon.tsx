import type { IconNode } from "lucide";

/** Renders a lucide icon (`import { Check } from "lucide"`) as inline SVG. Decorative: aria-hidden. */
export function Icon(props: { icon: IconNode; size?: number; class?: string; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size ?? 16}
      height={props.size ?? 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 2}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      aria-hidden="true"
      focusable="false"
    >
      {props.icon.map(([tag, attrs]) =>
        tag === "path" ? (
          <path {...attrs} />
        ) : tag === "circle" ? (
          <circle {...attrs} />
        ) : tag === "rect" ? (
          <rect {...attrs} />
        ) : tag === "line" ? (
          <line {...attrs} />
        ) : tag === "polyline" ? (
          <polyline {...attrs} />
        ) : tag === "polygon" ? (
          <polygon {...attrs} />
        ) : (
          <ellipse {...attrs} />
        ),
      )}
    </svg>
  );
}
