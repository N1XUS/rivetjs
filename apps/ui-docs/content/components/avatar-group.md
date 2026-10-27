---
title: AvatarGroup
description: "Display a stacked or grid group of avatars with overflow counting."
template: reference
status: experimental
related: [components/avatar, components/badge, components/chip]
---

`AvatarGroup` stacks [Avatars](avatar.md): a team, the people on a document. Avatars inside read the group's `size`, `color` and `variant`. With `max`, the rest collapse into a `+N` count.

Notes:

- `class`, not `className`.
- Each Avatar registers with the group through the context, also Avatars nested deeper than direct children.
- An explicit `Count` renders where you write it.

## Usage

```tsx
import { AvatarGroup } from "@rivetjs/ui/avatar-group";
import { Avatar } from "@rivetjs/ui/avatar";
```

::example{id=avatar-group-basic}

## Anatomy

```tsx
import { AvatarGroup } from "@rivetjs/ui/avatar-group";
import { Avatar } from "@rivetjs/ui/avatar";

export default () => (
  <AvatarGroup>
    <Avatar>
      <Avatar.Image />
      <Avatar.Fallback />
    </Avatar>
    <AvatarGroup.Count /> {/* Optional explicit child */}
  </AvatarGroup>
);
```

Additional exported parts: `AvatarGroup.Root`.

## Examples

### Max

::example{id=avatar-group-max}

### With Count

::example{id=avatar-group-count}

### Sizes

::example{id=avatar-group-sizes}

### Grid

::example{id=avatar-group-grid}

### Overlap

::example{id=avatar-group-overlap}

### Note

- AvatarGroup uses React Context to pass `size`, `color`, and `variant` to **direct Avatar children only**
- `max` truncates visible avatars when set and auto-counts remaining children; omit to show all
- For a known total (e.g. from the server), render an explicit `AvatarGroup.Count` — it is not truncated by `max` and suppresses the auto count. Prefer `Count` over the removed v2 `total` prop
- `isGrid` disables overlap and uses a wrapping grid layout instead
- `overlap` defaults to `"clip"` (crescent seam); use `"ring"` for the solid outline; no effect with `isGrid`
- No default `role="group"` — when the stack is meaningful (assignees, viewers), pass `role="group"` with `aria-label` or `aria-labelledby`

## Customization

### Tailwind CSS

::example{id=avatar-group-custom-styles}

### Global CSS

To customize the AvatarGroup component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .avatar-group {
    --avatar-group-overlap: 0.75rem;
    --avatar-group-seam: 2px;
  }

  .avatar-group__count {
    @apply font-semibold;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The AvatarGroup component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/avatar-group.css)):

#### Base Classes

- `.avatar-group` - Base avatar group container
- `.avatar-group--grid` - Grid layout modifier (no overlap)
- `.avatar-group--clip` - Crescent mask / transparent seam (default stacked overlap)
- `.avatar-group--ring` - Solid box-shadow outline via `--background`
- `.avatar-group__count` - Overflow count avatar

Stacked layout uses negative margin between siblings (`--avatar-group-overlap`, default `0.5rem`). Clip mode masks overlapped avatars (not the last child / Count) and optically nudges fallback glyphs; ring mode uses a thin box-shadow outline via `--background`.

## API Reference

See the [full module API](/api/rivetjs/ui/avatar-group/) for every named export and part prop type.

### AvatarGroup

| Prop       | Type                                                          | Default  | Description                                                                                       |
| ---------- | ------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `size`     | `'sm' \| 'md' \| 'lg'`                                        | `'md'`   | Size applied to child Avatars (and the overflow count) when they omit `size` (synced with Avatar) |
| `color`    | `'default' \| 'accent' \| 'success' \| 'warning' \| 'danger'` | -        | Color applied to child Avatars (and the overflow count) when they omit `color`                    |
| `variant`  | `'default' \| 'soft'`                                         | -        | Variant applied to child Avatars (and the overflow count) when they omit `variant`                |
| `max`      | `number`                                                      | -        | Maximum number of avatar children to render; omit to show all                                     |
| `isGrid`   | `boolean`                                                     | `false`  | Whether to use a wrapping grid layout without overlap                                             |
| `overlap`  | `'clip' \| 'ring'`                                            | `'clip'` | Stacked overlap style: crescent clip (default) or box-shadow ring; ignored when `isGrid`          |
| `class`    | `string`                                                      | -        | Additional CSS classes                                                                            |
| `children` | `Content`                                                     | -        | Avatar components (and optional `AvatarGroup.Count`) to group together                            |

### AvatarGroup.Count

Composes `Avatar` + `Avatar.Fallback` for the overflow indicator. Not truncated by `max`.

| Prop       | Type                                                          | Default | Description                     |
| ---------- | ------------------------------------------------------------- | ------- | ------------------------------- |
| `children` | `Content`                                                     | -       | Count content (e.g. `+3`)       |
| `size`     | `'sm' \| 'md' \| 'lg'`                                        | -       | Override size from the group    |
| `color`    | `'default' \| 'accent' \| 'success' \| 'warning' \| 'danger'` | -       | Override color from the group   |
| `variant`  | `'default' \| 'soft'`                                         | -       | Override variant from the group |
| `class`    | `string`                                                      | -       | Additional CSS classes          |

::api{symbol="@rivetjs/ui/avatar-group#AvatarGroupRootProps"}

## Accessibility

Plain markup. Name the group (`aria-label="Team"`, `role="group"`) when it stands for a list of people, and keep the hidden people reachable elsewhere: the `+N` count is only text.

## Related Components

- [Avatar](/components/avatar/): Display user profile images.
- [Badge](/components/badge/): Small indicator positioned relative to another element.
- [Chip](/components/chip/): Compact elements for tags and filters.
