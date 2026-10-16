---
title: Kbd
description: "@rivetjs/ui Kbd: a keyboard shortcut with Kbd.Abbr key symbols (labelled by title) and Kbd.Content text."
template: reference
status: experimental
related: [ui/heroui-port]
---

`Kbd` shows a keyboard shortcut. `Kbd.Abbr` renders a key symbol from a key name (with the full name as `title`), `Kbd.Content` renders text such as a letter. Port of HeroUI v3.2.6 [Kbd](https://www.heroui.com/docs/components/kbd).

## Import

```tsx
import { Kbd } from "@rivetjs/ui/kbd";
```

## Usage

```tsx
import { Kbd } from "@rivetjs/ui/kbd";

export default function Page() {
  return (
    <Kbd variant="light">
      <Kbd.Abbr keyValue="command" />
      <Kbd.Content>K</Kbd.Content>
    </Kbd>
  );
}
```

## Variants

`kbdVariants`:

| Prop | Values | Default |
| --- | --- | --- |
| `variant` | `default`, `light` | none |

## Parts

| Part | Element | Notes |
| --- | --- | --- |
| `Kbd` / `Kbd.Root` | `kbd` | class `kbd`, plus `kbd--<variant>` |
| `Kbd.Abbr` | `abbr` | `keyValue` picks the symbol; `title` is the key's name |
| `Kbd.Content` | `span` | plain text |

`keyValue` (`KbdKey`): `command`, `shift`, `ctrl`, `option`, `enter`, `delete`, `escape`, `tab`, `capslock`, `up`, `right`, `down`, `left`, `pageup`, `pagedown`, `home`, `end`, `help`, `space`, `fn`, `win`, `alt`. The maps are exported as `kbdKeysMap` (symbols) and `kbdKeysLabelMap` (names). All parts are generic over the element.

## Accessibility

Kbd is plain markup. The `abbr` carries the key's name in `title`, so "⌘" reads as "Command" where the browser exposes the title. For an exact label, add `aria-label` on the root.

## Differences from HeroUI React

- `class`, not `className`.
- The key symbols are the same text as HeroUI (they are labels, not icons).
- The variant reaches `Kbd.Abbr` and `Kbd.Content` through a resumable context.
