// Visual baseline matrix (identity lane T1): one story route per component, composed from the ui-docs examples' demo
// functions (`apps/ui-docs/examples/<id>/src/routes/index.tsx`, named export inside `#region demo`), so a docs example and
// its screenshot never drift apart. `app/gen-visual.ts` writes `app/src/routes/visual/<name>.tsx` (gitignored) before
// every story build; `visual.test.ts` screenshots each route at 1280 + 390 px, light + dark (+ RTL / keyboard focus).
export interface VisualEntry {
  /** Route + screenshot name (`/visual/<name>`, `<name>-<width>-<scheme>.png`). */
  name: string;
  /** ui-docs example ids, rendered top to bottom. */
  examples: string[];
  /** Selector clicked before the shot (opens the first example's overlay). Open routes hold a single example. */
  open?: string;
  /** Extra 1280 / light shot with `dir="rtl"` on `<html>`. */
  rtl?: boolean;
  /** Extra 1280 light + dark shots after one Tab press (keyboard focus ring on the first focusable). */
  focus?: boolean;
}

export const VISUAL: VisualEntry[] = [
  {
    name: "button",
    examples: [
      "button-variants",
      "button-brand",
      "button-sizes",
      "button-disabled",
      "button-icon-only",
      "button-with-icons",
      "button-loading",
      "button-full-width",
    ],
    focus: true,
  },
  { name: "button-group", examples: ["button-group-basic", "button-group-sizes", "button-group-with-icons", "button-group-orientation"], rtl: true },
  { name: "close-button", examples: ["close-button-default"] },
  { name: "chip", examples: ["chip-basic", "chip-variants", "chip-statuses", "chip-with-icon"] },
  { name: "tag-group", examples: ["tag-group-basic", "tag-group-sizes", "tag-group-variants", "tag-group-with-remove-button"], rtl: true },
  { name: "kbd", examples: ["kbd-basic", "kbd-variants", "kbd-special-keys"] },
  { name: "avatar", examples: ["avatar-colors", "avatar-fallback"] },
  { name: "card", examples: ["card-default", "card-variants", "card-with-form"] },
  { name: "theme-swap", examples: ["theme-swap"] },
  { name: "surface", examples: ["surface-variants", "surface-with-form-components"] },
  { name: "separator", examples: ["separator-basic", "separator-vertical", "separator-with-surface"] },
  { name: "link", examples: ["link-basic", "link-icon-placement"] },
  { name: "alert", examples: ["alert-basic"] },
  { name: "alert-dialog", examples: ["alert-dialog-default"], open: "button" },
  { name: "spinner", examples: ["spinner-sizes", "spinner-colors"] },
  { name: "empty-state", examples: ["empty-state-basic"] },
  { name: "progress", examples: ["progress-bar-basic", "progress-bar-sizes", "progress-bar-colors", "meter-sizes"] },
  { name: "input", examples: ["input-variants", "input-types", "input-on-surface"], focus: true },
  { name: "textfield", examples: ["textfield-basic", "textfield-shorthand", "textfield-with-description", "textfield-with-error", "textfield-disabled"] },
  { name: "textarea", examples: ["textarea-basic", "textarea-variants"] },
  {
    name: "input-group",
    examples: [
      "input-group-default",
      "input-group-variants",
      "input-group-with-prefix-and-suffix",
      "input-group-with-keyboard-shortcut",
      "input-group-invalid",
    ],
    rtl: true,
  },
  // Rivet field buttons (TW-145): concentric ghost buttons in Prefix / Suffix.
  {
    name: "input-group-buttons",
    examples: ["input-group-with-copy-suffix", "input-group-with-icon-prefix-and-copy-suffix", "input-group-password-with-toggle"],
    rtl: true,
    focus: true,
  },
  { name: "number-field", examples: ["number-field-basic", "number-field-variants", "number-field-with-chevrons"], rtl: true },
  { name: "search-field", examples: ["search-field-basic", "search-field-variants", "search-field-with-keyboard-shortcut"], rtl: true },
  {
    name: "checkbox",
    examples: ["checkbox-basic", "checkbox-variants", "checkbox-indeterminate", "checkbox-invalid", "checkbox-with-description", "checkbox-disabled"],
    rtl: true,
    focus: true,
  },
  { name: "radio-group", examples: ["radio-group-basic", "radio-group-horizontal", "radio-group-variants"], rtl: true },
  { name: "switch", examples: ["switch-basic", "switch-sizes", "switch-with-description"], rtl: true },
  { name: "slider", examples: ["slider-default", "slider-range", "slider-vertical"], rtl: true },
  { name: "select", examples: ["select-default", "select-shorthand"], open: "[data-slot=select-trigger]" },
  { name: "select-variants", examples: ["select-variants", "select-with-description"], rtl: true },
  { name: "combo-box", examples: ["combo-box-default"], open: "[data-slot=combo-box-trigger]" },
  // Morph icons (TW-149): default chevrons closed (all five pickers) + open per picker; Navbar burger closed / open.
  {
    name: "morph-chevron",
    examples: ["select-indicator", "combo-box-indicator", "autocomplete-indicator", "cell-select-indicator", "native-select-indicator"],
  },
  { name: "select-indicator-open", examples: ["select-indicator"], open: "[data-slot=select-trigger]" },
  { name: "combo-box-indicator-open", examples: ["combo-box-indicator"], open: "[data-slot=combo-box-trigger]" },
  { name: "autocomplete-indicator-open", examples: ["autocomplete-indicator"], open: "[data-slot=autocomplete-trigger]" },
  { name: "cell-select-indicator-open", examples: ["cell-select-indicator"], open: "[data-slot=cell-select-trigger]" },
  { name: "navbar-menu-toggle", examples: ["navbar-menu-toggle"] },
  { name: "navbar-menu-toggle-open", examples: ["navbar-menu-toggle"], open: "[data-slot=navbar-menu-toggle]" },
  { name: "list-box", examples: ["list-box-with-sections"] },
  { name: "dropdown", examples: ["dropdown-with-icons"], open: "button" },
  { name: "dropdown-selection", examples: ["dropdown-with-single-selection"], open: "button" },
  { name: "dropdown-descriptions", examples: ["dropdown-with-descriptions"], open: "button" },
  { name: "popover", examples: ["popover-basic"], open: "button" },
  { name: "modal", examples: ["modal-default"], open: "button" },
  { name: "drawer", examples: ["drawer-basic"], open: "button" },
  { name: "tabs", examples: ["tabs-basic", "tabs-secondary", "tabs-vertical", "tabs-with-separator"], rtl: true, focus: true },
  { name: "accordion", examples: ["accordion-basic", "accordion-surface"], rtl: true },
  { name: "calendar", examples: ["calendar-basic"], rtl: true },
  { name: "date-picker", examples: ["date-picker-basic"], open: "[data-slot=date-picker-trigger]" },
  { name: "color-picker", examples: ["color-picker-basic"], open: "[data-slot=color-picker-trigger]" },
  { name: "color-area", examples: ["color-area-basic"] },
  { name: "segment", examples: ["segment-basic", "segment-sizes", "segment-with-icons"] },
  { name: "toggle-button-group", examples: ["toggle-button-group-basic", "toggle-button-group-sizes", "toggle-button-group-attached"] },
  { name: "toast", examples: ["toast-simple"], open: "button" },
  { name: "skeleton", examples: ["skeleton-basic"] },
];
