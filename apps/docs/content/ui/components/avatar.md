---
title: Avatar
description: "@rivetjs/ui Avatar: an image with a fallback, on an in-tree port of the Radix avatar primitive; the image shows after it loads."
template: reference
status: experimental
related: [ui/heroui-port, ui/components/badge, ui/components/skeleton]
---

`Avatar` shows a user image with a fallback (initials, an icon) while the image loads or when it fails. Port of HeroUI v3.2.6 [Avatar](https://www.heroui.com/docs/components/avatar), on a Rivet port of `@radix-ui/react-avatar` 1.2.6.

## Import

```tsx
import { Avatar } from "@rivetjs/ui/avatar";
```

## Usage

```tsx
import { Avatar } from "@rivetjs/ui/avatar";

export default function Page() {
  return (
    <Avatar size="lg" color="accent">
      <Avatar.Image src="/images/ada.jpg" alt="Ada Lovelace" />
      <Avatar.Fallback>AL</Avatar.Fallback>
    </Avatar>
  );
}
```

## Variants

`avatarVariants`:

| Prop | Values | Default |
| --- | --- | --- |
| `size` | `sm`, `md`, `lg` | `md` |
| `color` | `default`, `accent`, `success`, `warning`, `danger` | `default` |
| `variant` | `default`, `soft` | none |

`color` styles the fallback only (`avatar__fallback--<color>`). `Avatar.Fallback` takes its own `color` to override it.

## Parts

| Part | Element | `data-slot` |
| --- | --- | --- |
| `Avatar` / `Avatar.Root` | `span` | — |
| `Avatar.Image` | `img` | — |
| `Avatar.Fallback` | `span` | `avatar-fallback` |

`Avatar.Image` props: `src`, `alt`, `srcSet`, `sizes`, `loading`, `crossOrigin`, `referrerPolicy`, `onLoad`, `onError`, `onLoadingStatusChange(status)` with `status` one of `idle`, `loading`, `loaded`, `error`. `Avatar.Fallback` takes `delayMs` to wait before showing.

## AvatarGroup

```tsx
import { Avatar } from "@rivetjs/ui/avatar";
import { AvatarGroup } from "@rivetjs/ui/avatar-group";

<AvatarGroup max={3} size="sm" overlap="ring">
  <Avatar><Avatar.Fallback>AB</Avatar.Fallback></Avatar>
  <Avatar><Avatar.Fallback>CD</Avatar.Fallback></Avatar>
  <Avatar><Avatar.Fallback>EF</Avatar.Fallback></Avatar>
  <Avatar><Avatar.Fallback>GH</Avatar.Fallback></Avatar>
</AvatarGroup>;
```

Every `Avatar` inside an `AvatarGroup` reads `size`, `color` and `variant` from `AvatarGroupContext`; its own props win. Pass `{ [AVATAR_GROUP_CHILD]: false }` to opt one out. With `max`, the group shows the first `max` avatars and appends an `AvatarGroup.Count` with `+N` (the hidden count). `max` can change: only the avatars that cross it are added or removed. Write your own `<AvatarGroup.Count>` (for example a server total) to replace the automatic count; it renders where you write it. `overlap` is `clip` (default) or `ring`; `isGrid` lays the avatars out in a grid.

## Loading behaviour

The server renders the root and the fallback, never the `<img>`. On the client, the image is probed with `new Image()`; when it loads, the `<img>` is inserted and the fallback removed. On a resumed page this probe runs on load without a user event. An image that fails keeps the fallback. A fallback with `delayMs` is not server-rendered: it appears after the delay on the client.

## Accessibility

Avatar is markup without cdk behaviour. Give `Avatar.Image` an `alt`. A fallback of initials is read as text; add `aria-label` on the root when the initials are not meaningful.

## Differences from HeroUI React

- `class`, not `className`.
- No Radix `asChild`: parts render fixed elements.
- No `<img>` in server markup (Radix also renders none before hydration); the fallback is the server output.
- `size`, `color` and `variant` reach the parts through a resumable context.
