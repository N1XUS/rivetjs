// Lucide icons for the panel (client-only app): lucide's own `createElement` builds the SVG with
// `createElementNS`, so the shapes are real SVG elements. (A JSX `<path {...attrs} />` mapped inside
// `<svg>` — the docs-kit Icon approach — is created in the HTML namespace on client renders and draws
// nothing; see ../CLAUDE.md Gotchas.) Never hand-write SVG paths or use UTF symbols as icons.
import { createElement, type IconNode } from "lucide";

/** Renders a lucide icon (`import { X } from "lucide"`) as inline SVG. Decorative: aria-hidden. */
export function Icon(props: { icon: IconNode; size?: number; class?: string; strokeWidth?: number }) {
  const size = props.size ?? 12;
  return createElement(props.icon, {
    width: size,
    height: size,
    "stroke-width": props.strokeWidth ?? 2,
    class: props.class ?? "icon",
    "aria-hidden": "true",
    focusable: "false",
  });
}
