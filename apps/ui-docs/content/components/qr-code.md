---
title: QRCode
description: "A QR code from a value, rendered on the server as SVG: square, dots or rounded modules, gradient presets, a centred icon, a loading placeholder and a shimmer."
template: reference
status: experimental
related: [components/skeleton, components/text-shimmer, components/text-field, components/card]
---

`QRCode` encodes its `value` (a link, a Wi-Fi string, any text) into an SVG QR code. The server renders the whole symbol, so a static `value` ships no JavaScript; a reactive `value` re-encodes in place. The encoder is `@rivetjs/cdk/qr-code`, a port of Project Nayuki's QR Code generator (MIT): numeric, alphanumeric and UTF-8 byte modes, the smallest version that fits, error correction raised while the data still fits, and the mask with the lowest ISO 18004 penalty.

:::note
Rivet addition: no HeroUI counterpart.
:::

## Usage

```tsx
import { QRCode } from "@rivetjs/ui/qr-code";
```

::example{id=qr-code-basic}

### Shapes

`shape="square"` is the standard symbol. `dots` draws round modules with rounded finder eyes. `rounded` joins neighbouring modules into one path, with rounded outer corners and filleted inner corners. Every shape keeps the module centres where a scanner samples them.

::example{id=qr-code-shapes}

### Icon

Children (or the `icon` prop) sit on a plate in the centre. The modules under the plate are cleared (data and alignment modules only: finder, timing, format and version modules stay), and the error correction defaults to `H` (30 % of the codewords recoverable) unless you set `ecc`. `iconSize` sets the plate side as a fraction of the symbol (0.1 to 0.3, default 0.22). Any content works: a lucide `Icon`, a logo `img`, initials.

::example{id=qr-code-icon}

### Loading

`isLoading` renders a placeholder symbol (real finder patterns, made-up data, no format information, so scanners reject it) with a skeleton sweep and `aria-busy="true"`. An empty `value` shows the placeholder without the sweep.

::example{id=qr-code-loading}

### Shimmer

`shimmer` adds a decorative light sweep over the finished code. Both sweeps are CSS animations and stop under `prefers-reduced-motion: reduce`.

::example{id=qr-code-shimmer}

### Colors

`color="default"` uses the theme foreground, `accent` the accent colour, `brand` (the Rivet logo gradient) and `sunset` a gradient. A custom colour goes through `--qr-code-fg` / `--qr-code-bg`. The code keeps dark modules on a light background in dark mode too: inverted codes fail on many scanners. Keep enough contrast between the two colours.

::example{id=qr-code-colors}

### Sizes

`size` takes `sm` / `md` / `lg` (128 / 160 / 224 px at the default spacing) or a side in pixels. `margin` is the quiet zone in modules (default 4, as ISO 18004 asks; a smaller one such as `margin={2}` still scans on a plain card).

::example{id=qr-code-sizes}

## Anatomy

```tsx
import { Icon } from "@rivetjs/kit/icon";
import { QRCode } from "@rivetjs/ui/qr-code";
import { Link } from "lucide";

export default function Anatomy() {
  return (
    <QRCode value="https://rivetjs.severyn.pro" shape="rounded" color="brand" aria-label="Rivet docs">
      <Icon icon={Link} />
    </QRCode>
  );
}
```

Accessibility: the code is `role="img"`, named by `aria-label` or, without one, by the encoded text (screen reader users can read or copy what the code holds). With no name (empty `value`, no label) it is `aria-hidden`. Put the purpose in nearby text too ("Scan to join the Wi-Fi"), and offer the link or text itself for people who cannot scan.

## Styling Reference

### CSS Classes

- `.qr-code` - Root (`div`, square, rounded corners, background).
- `.qr-code--square` / `--dots` / `--rounded` - Module shape.
- `.qr-code--default` / `--accent` / `--brand` / `--sunset` - Colour.
- `.qr-code--sm` / `--md` / `--lg` - Size.
- `.qr-code--shimmer` - Decorative `::after` sweep.
- `.qr-code__svg` - The symbol (quiet zone included).
- `.qr-code__body` - Data, timing and alignment modules (one path; `dots`: zero-length strokes with round caps).
- `.qr-code__eyes` - The three finder patterns (one path).
- `.qr-code__icon` - Centred icon plate.

### CSS Variables

- `--qr-code-fg` / `--qr-code-bg` - Module and background colour.
- `--qr-code-eye` - Finder pattern colour (default: the module colour; not with a gradient).
- `--qr-code-gradient-1` / `-2` / `-3` - Gradient stops of `brand` / `sunset`.
- `--qr-code-size` - Side (set by `size`).
- `--qr-code-dot` - Dot diameter in modules for `dots` (default 0.84).
- `--qr-code-radius` - Corner radius of the root.

### Data Attributes

- `[data-slot="qr-code"]` - Root; `[data-slot="qr-code-icon"]` - icon plate.
- `[data-loading]` - Placeholder shown with the sweep.
- `[data-gradient]` - A gradient preset paints the paths.
- `[data-invalid]` - The value is too long for a version-40 code (the symbol stays empty).

## API Reference

### QRCode

| Prop         | Type                                           | Default                        | Description                                           |
| ------------ | ---------------------------------------------- | ------------------------------ | ----------------------------------------------------- |
| `value`      | `string \| (() => string)`                     | -                              | Text to encode (reactive)                             |
| `shape`      | `"square" \| "dots" \| "rounded"`              | `"square"`                     | Module shape                                          |
| `color`      | `"default" \| "accent" \| "brand" \| "sunset"` | `"default"`                    | Colour or gradient preset                             |
| `size`       | `"sm" \| "md" \| "lg" \| number`               | `"md"`                         | Side (number = px)                                    |
| `ecc`        | `"L" \| "M" \| "Q" \| "H"`                     | `"H"` with an icon, else `"M"` | Minimum error correction (raised while the data fits) |
| `margin`     | `number`                                       | `2`                            | Quiet zone in modules                                 |
| `icon`       | `Content`                                      | -                              | Centred content (same slot as children)               |
| `iconSize`   | `number`                                       | `0.22`                         | Icon plate side as a fraction of the symbol (0.1–0.3) |
| `isLoading`  | `boolean \| (() => boolean)`                   | `false`                        | Placeholder + skeleton sweep                          |
| `shimmer`    | `boolean`                                      | `false`                        | Decorative light sweep                                |
| `aria-label` | `string`                                       | the value                      | Accessible name                                       |
| `class`      | `string`                                       | -                              | Additional CSS classes                                |

Also takes `div` props. Headless pieces (encoder, module roles, excavation, path builders) live in `@rivetjs/cdk/qr-code`: `encodeQr(text, { ecc, minVersion, maxVersion, mask, boostEcc })`, `qrPaths(matrix, shape)`, `centerRect`, `excavate`, `placeholderQr`, `moduleRole`.

## Related Components

- [Skeleton](/components/skeleton/): Placeholder blocks with the same sweep.
- [TextShimmer](/components/text-shimmer/): A shimmering label.
- [TextField](/components/text-field/): Edit the value a code encodes.
- [Card](/components/card/): Frame a code with its instructions.
