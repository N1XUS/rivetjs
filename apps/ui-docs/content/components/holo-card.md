---
title: HoloCard
description: "A 3D tilting card with a pointer-tracked holographic glare and texture, for membership cards, passes and collectibles."
template: reference
status: experimental
related: [components/card, components/item-card]
---

`HoloCard` tilts toward the pointer and lights a holographic glare where the pointer is. The root writes a few CSS variables on pointer move; the tilt, glare and parallax are CSS. The first pointer input resumes the card; no card script runs before input. On touch devices, a tap enables device tilt. The card stays flat with `prefers-reduced-motion`.

## Usage

```tsx
import { HoloCard } from "@rivetjs/ui/holo-card";
```

::example{id=holo-card-basic}

## Anatomy

```tsx
import { HoloCard } from "@rivetjs/ui/holo-card";

export default function Anatomy() {
  return (
    <HoloCard>
      <HoloCard.Rotator>
        <HoloCard.Frame>
          <HoloCard.Surface>
            <HoloCard.Image alt="" src="/art.jpg" />
            <HoloCard.Inset />
            <HoloCard.Pattern />
            <HoloCard.Content />
            <HoloCard.Shine />
          </HoloCard.Surface>
        </HoloCard.Frame>
      </HoloCard.Rotator>
    </HoloCard>
  );
}
```

`Rotator`, `Frame` and `Surface` are required; the other layers are optional. `Shine` renders a `ShinePattern` unless it has children.

Additional exported parts: `HoloCard.Root`, `HoloCard.ShinePattern`.

## Examples

### Composing the Card Face

Render one `HoloCard.Content` per band of the card and position its children with flex utilities. Content layers drift against the tilt (`parallax={false}` turns that off) and sit above the glare so text stays readable. Put full-bleed art in `HoloCard.Image` (below the glare), not in a content layer.

### Image Only

::example{id=holo-card-image-only}

Leave out `HoloCard.Content` and the art is the whole face: `Pattern` and `Shine` blend over it. Size the card to the art's aspect ratio with `--holo-card-width` / `--holo-card-height` (default 302 × 453 px). Without an `img`, a `gradient` alone is the card's background.

### Custom Gradient

::example{id=holo-card-custom-gradient}

### With Pattern

::example{id=holo-card-pattern}

### On phones and tablets

Tap the card once to enable device tilt. On iOS, the card requests motion permission once per page; allow it to enable the effect. Your holding angle becomes the neutral position, and moving the device up to 25 degrees in either direction tilts the card and moves the glare. Turning the screen recalibrates the neutral position.

Tracking pauses while the card is offscreen or the page is hidden. Sensor readings stay on the page. If permission is denied or no usable sensor reading arrives within one second, horizontal touch drags still tilt the card and vertical drags scroll the page.

With reduced motion enabled, `isInteractive={false}`, or `isDisabled`, the card stays flat and unlit and does not request permission or track device movement.

### Static

::example{id=holo-card-static}

### Membership Card

::example{id=holo-card-membership}

Three `HoloCard.Content` bands (header, portrait and name, member number and expiry) over a `gradient`. Give the portrait meaningful `alt` text: it is content, not decoration.

### Credit Card

::example{id=holo-card-credit-card}

## Styling Reference

The component’s parts emit these additional `data-slot` values: `holo-card-rotator`, `holo-card-frame`, `holo-card-surface`, `holo-card-shine-pattern`, `holo-card-shine`, `holo-card-image`, `holo-card-content`.

### CSS Classes

- `.holo-card` - Perspective wrapper; declares the variables.
- `.holo-card__rotator` - 3D tilt layer.
- `.holo-card__frame` - Bounds the tilted card moves within.
- `.holo-card__surface` - Card body with the gradient background.
- `.holo-card__image` - Full-bleed art under every overlay.
- `.holo-card__inset` - Hairline border inside the edge.
- `.holo-card__pattern` - Static texture.
- `.holo-card__content` - Parallax layer for the card face.
- `.holo-card__shine` - Holographic glare.
- `.holo-card__shine-pattern` - Texture the glare reveals.

### Data Attributes

- `[data-active="true"]` on the root while the pointer is over the card or device tilt is active.
- `[data-static="true"]` on the root when `isInteractive={false}` or `isDisabled`.
- `[data-parallax="false"]` on a content layer without parallax.

### CSS Variables

| Variable                      | Default       | Description                       |
| ----------------------------- | ------------- | --------------------------------- |
| `--holo-card-width`           | `302px`       | Card width                        |
| `--holo-card-height`          | `453px`       | Card height                       |
| `--holo-card-radius`          | `20px`        | Corner radius                     |
| `--holo-card-perspective`     | `600px`       | 3D perspective depth              |
| `--holo-card-gradient`        | dark gradient | Surface background                |
| `--holo-card-inset-color`     | white 6 %     | Hairline border colour            |
| `--holo-card-pattern`         | rainbow sheen | Texture for both texture layers   |
| `--holo-card-pattern-size`    | `200% 200%`   | `background-size` of the textures |
| `--holo-card-pattern-opacity` | `0.9`         | Glare texture opacity             |
| `--holo-card-texture-opacity` | `0.1`         | Static texture opacity            |
| `--holo-card-parallax`        | `10`          | Content drift at the edge (px)    |

Image textures: inline styles refuse `url()`, so set `--holo-card-pattern: url(...)` in a stylesheet rule on a class and pass the class.

Written by pointer or device movement (read only): `--holo-card-pointer-x`, `--holo-card-pointer-y` (0–100), `--holo-card-background-x`, `--holo-card-background-y`, `--holo-card-opacity` (0 or 1).

## API Reference

See the [full module API](/api/rivetjs/ui/holo-card/) for every named export and part prop type.

### HoloCard

A `div` that tracks the pointer or, after a touch tap, device movement. Wrap it in a flex or grid container to position it.

| Prop               | Type      | Default | Description                                     |
| ------------------ | --------- | ------- | ----------------------------------------------- |
| `gradient`         | `string`  | -       | Surface background (`--holo-card-gradient`)     |
| `patternSize`      | `string`  | -       | Texture `background-size`                       |
| `isInteractive`    | `boolean` | `true`  | Tilt and light up on pointer or device movement |
| `isDisabled`       | `boolean` | `false` | No pointer or device tracking                   |
| `parallaxStrength` | `number`  | `10`    | How far content layers drift (px)               |

### HoloCard.Rotator / Frame / Surface / Inset / Pattern / Shine / ShinePattern

`div` layers (`div` attributes and `class`).

### HoloCard.Image

An `img` (`alt` required; `""` for decorative art).

### HoloCard.Content

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `parallax` | `boolean` | `true`  | Drift against the tilt |

## Accessibility

The root is a plain `div`, not an interactive control. Tilt and glare are decorative and remain flat under reduced motion. Use real, labelled buttons or links for actions inside the card and meaningful alternative text for informative images.

## Related Components

- [Card](/components/card/)
- [ItemCard](/components/item-card/)
