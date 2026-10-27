---
title: Theme API
description: "Derive theme tokens, generate CSS, select presets and inspect color contrast with @rivetjs/ui/theme."
template: reference
status: experimental
related: [start/themes, start/theming, start/colors, start/styling]
---

`@rivetjs/ui/theme` provides framework-independent functions for deriving theme tokens, exporting CSS and checking color contrast.

## Usage

```ts
import { RIVET_PRESET, deriveTheme, themeCss, auditContrast } from "@rivetjs/ui/theme";

const tokens = deriveTheme(RIVET_PRESET);
const css = themeCss(RIVET_PRESET);
const lightContrast = auditContrast(RIVET_PRESET, "light", tokens);
const darkContrast = auditContrast(RIVET_PRESET, "dark", tokens);
```

Paste the generated CSS after `@import "@rivetjs/ui/styles";`. The live example below demonstrates the shipped presets; generating a CSS string does not insert it into the document.

::example{id=theme-swap}

## Anatomy

This entry exports functions, types and preset data, not JSX components. It combines color conversion, token derivation, presets and contrast analysis. Use the [theme builder](/themes/) to explore these values visually.

## API Reference

| Export                                            | Purpose                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `deriveTheme(params)`                             | Derive light and dark theme tokens from `ThemeParams`.                              |
| `themeVariables(params, mode, tokens?)`           | Return the CSS custom-property values for one mode.                                 |
| `themeCss(params, options?, tokens?)`             | Generate a stylesheet string; options include light/dark selectors and indentation. |
| `RIVET_PRESET`, `CLASSIC_PRESET`, `THEME_PRESETS` | Shipped preset objects and the preset collection.                                   |
| `resolveParams(params)`, `matchPreset(params)`    | Resolve preset parameters and find a matching preset.                               |
| `auditContrast(params, mode, tokens?, pairs?)`    | Evaluate the selected contrast pairs for a derived theme.                           |
| `auditVariables(vars, mode, pairs?)`              | Evaluate the contrast pairs against a CSS-variable map.                             |
| `CONTRAST_PAIRS`                                  | The default semantic foreground/background checks.                                  |
| `hexToOklch`, `oklchToHex`, `parseOklch`          | Convert or parse color values.                                                      |
| `contrastRatio`, `apcaContrast`                   | Calculate WCAG contrast ratio or APCA contrast for RGB colors.                      |

`ThemeParams` defines the inputs; `ThemeTokens` and `ThemeMode` describe the outputs and selected mode. The default preset used by an app should be explicit: pass `RIVET_PRESET` for the Rivet look.

## Accessibility

Check both light and dark modes, and inspect hover, focus, disabled and elevated surfaces in the rendered interface. The contrast functions evaluate the supplied pairs; they do not audit the full page or replace accessible labels and keyboard behavior.

## Related Components

- [Themes](/start/themes/)
- [Theming](/start/theming/)
- [Colors](/start/colors/)
