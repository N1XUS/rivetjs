---
title: Themes
description: The Rivet brand theme is the theme of @rivetjs/ui; other looks (Classic, Brutalist, Glass, Mauve, …) are presets. Build your own from one OKLCH accent.
template: guide
status: experimental
related: [start/theming, start/colors, start/dark-mode]
---

`@rivetjs/ui` ships one theme, Rivet. A theme is CSS variables only: component class names and markup never change, so switching looks never changes the HTML.

## Swap the whole look

Pick a preset: the four cards below re-skin at once (colours, radii, border widths, shadows, frosted glass). Only one attribute changes, `data-ui-preset` on the wrapper; the cards keep their HTML. **Edit theme** opens the preset in the [theme builder](/themes/).

::example{id=theme-swap}

| Preset    | Character                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rivet     | The default theme: logo-blue accent, tinted neutrals and shadows, dark hairlines.                                                                 |
| Classic   | The upstream stylesheet's original default theme (`CLASSIC_PRESET`, `oklch(0.6204 0.195 253.83)`).                                                |
| Brutalist | Square corners (radius `none`), 2 px ink borders (`--border-width`, `--field-border-width`), hard offset shadows, cream paper.                    |
| Glass     | Translucent surfaces and fields, a blurred backdrop on cards (`--surface-backdrop`), white hairlines, large radii. Needs colour behind the cards. |
| Mauve     | Dusty rose accent, rose-tinted neutrals and shadows, large soft radii.                                                                            |

Every preset of the theme builder (these five plus Sky, Lavender, Mint, Ocean, Iris, Ember, Mono) is also available scoped to an attribute: import `@rivetjs/ui/styles/themes/presets.css` once, then any element with `data-ui-preset="<id>"` shows that preset, in light and dark (generated from `THEME_PRESETS`, every variable declared again on the element).

Limitation: a preset's light blocks in `presets.css` (`[data-ui-preset]`) do not win over a `.dark` ancestor, so a subtree forced to a light preset inside a dark page is not possible; for a light island in a dark page, scope the default theme with `data-theme="light"` instead.

```css
@import "@rivetjs/ui/styles";
@import "@rivetjs/ui/styles/themes/presets.css" layer(theme);
```

```tsx
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";

export function Swap() {
  const look = signal("brutalist");
  return (
    <section data-ui-preset={look()}>
      <Button onPress={() => look.set(look() === "brutalist" ? "glass" : "brutalist")}>Swap</Button>
    </section>
  );
}
```

| Theme           | Import                          | What it is                                                                                                                                                                                 |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rivet (default) | `@import "@rivetjs/ui/styles";` | The base theme with the Rivet tokens on top: accent from the logo blue (`oklch(0.52 0.24 264)`), neutrals tinted toward it, WCAG AA + APCA contrast fixes, dark hairlines, tinted shadows. |

Other looks are presets: variables pasted after the import, or scoped to an attribute (above). The original default theme is `CLASSIC_PRESET` in `@rivetjs/ui/theme` (`oklch(0.6204 0.195 253.83)` accent), one click away in the [theme builder](/themes/).

The theme responds to the light / dark switches: `.light` / `.dark` classes and `data-theme="light"` / `data-theme="dark"`.

:::note
The Rivet theme is generated from the theme derivation in `@rivetjs/ui/theme` (`libs/ui/scripts/gen-themes.ts`); a test checks every text / background pair the components paint against WCAG AA (4.5:1 text, 3:1 focus ring) and APCA (Lc 60 text, Lc 30 focus ring and chart series) in light and dark. The Classic accent misses AA on white text (3.6:1); the Rivet accent is deeper for that reason. Dark mode raises the focus ring to L 0.68 and the muted text to L 0.78, cards and overlays get a 1 px hairline at 8 % white, and shadows are tinted toward the neutral hue.
:::

## Use another look

**Whole app:** paste a preset's variables after the import (the theme builder's "Copy CSS", or `themeCss(CLASSIC_PRESET)`).

```css
@import "tailwindcss";
@import "@rivetjs/ui/styles";
/* then the exported variables, e.g. the Classic preset from the theme builder */
```

**Part of a page:** a subtree takes a preset as an inline `style` (`themeVariables(preset, mode)`), or the Rivet tokens on a page whose own variables differ: import the scoped Rivet theme once and mark the subtree with `data-ui-theme="rivet"`. Every token, including the derived hover / soft / border formulas, is declared again on the marked element, in light and dark.

```css
@import "@rivetjs/ui/styles/themes/scoped.css" layer(theme);
```

```tsx
import { Button } from "@rivetjs/ui/button";
import { CLASSIC_PRESET, themeVariables } from "@rivetjs/ui/theme";

export function Compare() {
  return (
    <div class="flex gap-4">
      <section data-ui-theme="rivet">
        <Button>Rivet</Button>
      </section>
      <section style={themeVariables(CLASSIC_PRESET, "light")}>
        <Button>Classic preset</Button>
      </section>
    </div>
  );
}
```

Overlays keep the scope: Popover, Select, Menu, Tooltip, Modal, Drawer, Toast and the other portaled surfaces render in the overlay layer at the end of `<body>`, outside the marked subtree, so on open their layer element gets the trigger's `data-ui-theme`, `data-ui-preset` and `data-theme` (and `.dark`) copied over. Nested overlays inherit it; an overlay opened outside any scope gets nothing and follows the page theme. An inline `style={themeVariables(…)}` is not copied: for a subtree with overlays, use an attribute (`data-ui-theme`, or `data-ui-preset` from `themes/presets.css`).

## Brand tokens

The Rivet theme also declares the logo gradient stops as `--rivet-cyan`, `--rivet-blue`, `--rivet-indigo`, `--rivet-violet`, `--rivet-purple`, `--rivet-magenta`, `--rivet-pink` (Tailwind colours `rivet-*`, e.g. `text-rivet-indigo`) and the full gradient as `--rivet-gradient`. Use them for special surfaces (a hero, a highlight border), not for text or controls: the components only use the semantic tokens.

```tsx
export function Hero() {
  return <div class="h-2 rounded-full bg-(image:--rivet-gradient)" />;
}
```

## Theme builder

The [theme builder](/themes/) derives a full theme from one accent: OKLCH lightness, chroma and hue sliders, gray chroma for the neutrals, radius, presets (Rivet, Classic, the Brutalist / Glass / Mauve looks and the colour presets Sky, Lavender, Mint, Ocean, Iris, Ember, Mono), a light / dark preview of the real components composed into small app screens (sign-up form, settings, invoices table, booking calendar, plan and billing, project tabs, assistant chat; its menus, popovers, date picker, modal and toasts open inside the preview, on the edited theme), a contrast check, and the CSS to copy or download. The URL keeps the values (`/themes/?lightness=0.6204&chroma=0.195&hue=253.83`), so a link shares a theme.

Paste the exported CSS after the `@rivetjs/ui/styles` import. It sets only the authored tokens; the stylesheet derives the rest.

## Derive a theme in code

`@rivetjs/ui/theme` exposes the same derivation as framework-free functions (origin and license: [Licenses](/start/licenses/)):

```tsx
import { auditContrast, deriveTheme, themeCss, themeVariables } from "@rivetjs/ui/theme";

const params = { lightness: 0.62, chroma: 0.19, hue: 160, base: 0.004, radius: "large" as const };

const tokens = deriveTheme(params); // { light: { "--accent": "oklch(…)", … }, dark: { … } }
const css = themeCss(params); // the snippet the builder exports
const vars = themeVariables(params, "dark"); // every variable for an inline `style` (scoped preview)
const failing = auditContrast(params, "light").filter((r) => !r.pass);
```

`auditContrast` checks the pairs the components paint (`CONTRAST_PAIRS`): text on every surface level and on fields at WCAG AA 4.5:1 and APCA Lc 60 (`apcaContrast`, APCA-W3 0.1.9), the focus ring, accent fill and chart series at 3:1 and Lc 30. The theme builder lists the pairs that fail.
