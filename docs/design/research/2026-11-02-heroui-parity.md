# HeroUI v3.2.6 parity (2026-11-02)

Compared against `heroui-inc/heroui` @ `73000ea` (`libs/ui/UPSTREAM`). Supersedes the unchecked boxes in `docs/design/plans/2026-10-0*-heroui-port-plan-*.md`: those plans are history, their checkboxes were never ticked.

- Components: 86 upstream dirs in `packages/react/src/components`; all present in `libs/ui/src/components` except internal `rac` (cdk replaces it). Same dir names, incl. `textarea` / `textfield`; docs pages are `text-area` / `text-field`.
- Exports: 1008 names from upstream `index.ts` files (+ the two text dirs); every one exported by the Rivet `index.ts`, except one rename: `HeroUIToastOptions` → `ToastOptions` (no upstream brand in public names).
- Demos: 690 `apps/docs/src/demos/en` files. 678 match an example id by name. The other 12:
  - 8 renamed in Rivet: `kbd-{inline,instructional,navigation,special}` → `kbd-inline-usage`, `kbd-instructional-text`, `kbd-navigation-keys`, `kbd-special-keys`; `textarea-custom-styles` → `text-area-custom-styles`; `textfield-custom-styles` → `text-field-custom-styles`; `date-picker-format-options-no-ssr`, `date-range-picker-format-options-no-ssr` → the `format-options` demos (upstream's client-only wrappers; Rivet needs none).
  - 4 release-note demos ported on 2026-11-02: `button-outline-variant`, `chip-vibrant-palette`, `date-range-picker-input-container`, `list-box-scrollbar-modes`. Their features already shipped; only the demos were missing.
- Not compared: behaviour case by case beyond the ported upstream test suites, and pixel parity (the look is Rivet's own since the identity lane).
