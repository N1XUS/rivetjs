// Rivet (internal, MOTION-HARMONY 2026-10-29): read an element's motion timing from its computed style, so JS that has
// to follow a CSS transition / animation (a script fade on top of it, a window that waits for it) never duplicates a
// duration or a curve. Pattern: Angular CDK `getTransformTransitionDurationInMs` (`../drag-drop/dom/transition-duration.ts`).

/** CSS time (`"0.26s"`, `"260ms"`) → milliseconds (0 when not a time). */
export function cssTimeMs(value: string | undefined): number {
  const n = parseFloat(value ?? "");
  if (!Number.isFinite(n)) return 0;
  return /ms\s*$/i.test(value!) ? n : n * 1000;
}

const list = (style: CSSStyleDeclaration, name: string): string[] =>
  style
    .getPropertyValue(name)
    .split(/,(?![^(]*\))/)
    .map((part) => part.trim());

/**
 * The timing `element` animates `property` with right now: its first CSS animation when one is set (`animation-name`
 * not `none`), else the transition of `property` (or `all`). `null` when nothing animates it (incl. reduced-motion
 * rules that set `transition: none` / `animation: none`, or a 0 s duration).
 */
export function cssTiming(element: Element, property: string): { duration: number; easing: string } | null {
  const view = element.ownerDocument.defaultView;
  if (!view) return null;
  const style = view.getComputedStyle(element);
  const names = list(style, "animation-name");
  if (names[0] && names[0] !== "none") {
    const duration = cssTimeMs(list(style, "animation-duration")[0]);
    return duration > 0 ? { duration, easing: list(style, "animation-timing-function")[0] || "ease" } : null;
  }
  const props = list(style, "transition-property");
  const index = props.findIndex((p) => p === property || p === "all");
  if (index < 0) return null;
  const durations = list(style, "transition-duration");
  const easings = list(style, "transition-timing-function");
  // Shorter lists repeat (CSS Transitions §2).
  const duration = cssTimeMs(durations[index % durations.length]);
  return duration > 0 ? { duration, easing: easings[index % easings.length] || "ease" } : null;
}

/** The longest transition duration of `element` in ms (0 = none): how long a state change of it animates. */
export function cssTransitionMs(element: Element): number {
  const view = element.ownerDocument.defaultView;
  if (!view) return 0;
  const style = view.getComputedStyle(element);
  const durations = list(style, "transition-duration");
  const delays = list(style, "transition-delay");
  return Math.max(0, ...durations.map((d, i) => cssTimeMs(d) + cssTimeMs(delays[i % delays.length])));
}
