// Rivet-authored (no upstream file). Keeps a body-level drag preview's inherited typography.
//
// Angular CDK inserts the preview at the end of `<body>` (`previewContainer: "global"`), so it inherits
// the body's text styles instead of the ones the dragged element got from its ancestors: a card in a
// `text-sm` board grows to the body's 16px while its `text-xs` parts stay the same (user bug 2026-10-09,
// "kanban - dragged item has different font sizes"). The preview root carries the source parent's
// computed inherited text properties as custom properties; the resets layer (`drag-drop-registry.ts`,
// the lowest-priority layer) applies them, so any class or rule the app gives the element or
// `.cdk-drag-preview` still wins, as inheritance would let it.

/** Inherited text properties a global preview takes from the dragged element's parent. */
const INHERITED_TEXT = [
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "font-variant-numeric",
  "font-feature-settings",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-align",
  "text-transform",
  "white-space",
];

const variable = (property: string) => `--rv-drag-${property}`;

/** The `.cdk-drag-preview` declarations of the resets layer: the carried values, else plain inheritance. */
export const INHERITED_TEXT_RESETS = INHERITED_TEXT.map((property) => `${property}:var(${variable(property)},inherit)`).join(";");

/** Copies `source`'s computed inherited text properties onto `preview` (as the resets layer's custom properties). */
export function carryInheritedText(preview: HTMLElement, source: Element): void {
  const computed = getComputedStyle(source);
  const style = preview.style;
  for (const property of INHERITED_TEXT) {
    const value = computed.getPropertyValue(property);
    if (value) style.setProperty(variable(property), value);
  }
  // A unitless line height inherits as the factor (each descendant multiplies its own font size);
  // the computed style string is the resolved px value, so keep the number where Typed OM exposes it.
  const lineHeight = source.computedStyleMap?.().get("line-height");
  if (lineHeight && (lineHeight as CSSUnitValue).unit === "number") {
    style.setProperty(variable("line-height"), String((lineHeight as CSSUnitValue).value));
  }
}
