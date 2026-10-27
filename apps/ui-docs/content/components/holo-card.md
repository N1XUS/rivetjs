---
title: HoloCard
description: "A 3D tilting card with a pointer-tracked holographic glare and texture, for membership cards, passes and collectibles."
template: reference
status: experimental
related: [components/card, components/item-card]
---

`HoloCard` tilts toward the pointer and lights a holographic glare where the pointer is. The root writes a few CSS variables on pointer move; the tilt, glare and parallax are CSS. No script runs before the first pointer move (it resumes the card), and the card stays flat with `prefers-reduced-motion`.

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

## Composing the Card Face

Render one `HoloCard.Content` per band of the card and position its children with flex utilities. Content layers drift against the tilt (`parallax={false}` turns that off) and sit above the glare so text stays readable. Put full-bleed art in `HoloCard.Image` (below the glare), not in a content layer.

## Custom Gradient

::example{id=holo-card-custom-gradient}

## With Pattern

::example{id=holo-card-pattern}

## Static

On touch screens, horizontal drags tilt the card and vertical drags scroll the page.

::example{id=holo-card-static}

## Credit Card

::example{id=holo-card-credit-card}

## Styling Reference

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

- `[data-active="true"]` on the root while the pointer is over the card.
- `[data-static="true"]` on the root when `isInteractive={false}` or `isDisabled`.
- `[data-parallax="false"]` on a content layer without parallax.

### CSS Variables

| Variable                      | Default         | Description                            |
| ----------------------------- | --------------- | -------------------------------------- |
| `--holo-card-width`           | `302px`         | Card width                             |
| `--holo-card-height`          | `453px`         | Card height                            |
| `--holo-card-radius`          | `20px`          | Corner radius                          |
| `--holo-card-perspective`     | `600px`         | 3D perspective depth                   |
| `--holo-card-gradient`        | dark gradient   | Surface background                     |
| `--holo-card-inset-color`     | white 6 %       | Hairline border colour                 |
| `--holo-card-pattern`         | rainbow sheen   | Texture for both texture layers        |
| `--holo-card-pattern-size`    | `200% 200%`     | `background-size` of the textures      |
| `--holo-card-pattern-opacity` | `0.9`           | Glare texture opacity                  |
| `--holo-card-texture-opacity` | `0.1`           | Static texture opacity                 |
| `--holo-card-parallax`        | `10`            | Content drift at the edge (px)         |

Image textures: inline styles refuse `url()`, so set `--holo-card-pattern: url(...)` in a stylesheet rule on a class and pass the class.

Written by the card on pointer move (read only): `--holo-card-pointer-x`, `--holo-card-pointer-y` (0–100), `--holo-card-background-x`, `--holo-card-background-y`, `--holo-card-opacity` (0 or 1).

## API Reference

### HoloCard

A `div` that tracks the pointer. Wrap it in a flex or grid container to position it.

| Prop               | Type      | Default | Description                                         |
| ------------------ | --------- | ------- | --------------------------------------------------- |
| `gradient`         | `string`  | -       | Surface background (`--holo-card-gradient`)         |
| `patternSize`      | `string`  | -       | Texture `background-size`                           |
| `isInteractive`    | `boolean` | `true`  | Tilt and light up on pointer move                   |
| `isDisabled`       | `boolean` | `false` | No pointer tracking                                 |
| `parallaxStrength` | `number`  | `10`    | How far content layers drift (px)                   |

### HoloCard.Rotator / Frame / Surface / Inset / Pattern / Shine / ShinePattern

`div` layers (`div` attributes and `class`).

### HoloCard.Image

An `img` (`alt` required; `""` for decorative art).

### HoloCard.Content

| Prop       | Type      | Default | Description                    |
| ---------- | --------- | ------- | ------------------------------ |
| `parallax` | `boolean` | `true`  | Drift against the tilt         |
