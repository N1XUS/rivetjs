---
title: Link
description: "@rivetjs/ui Link: a HeroUI-styled anchor on the cdk Link, with an optional Link.Icon for external links."
template: reference
status: experimental
related: [ui/heroui-port, ui/components/button, guides/routing/links-and-navigation]
---

`Link` styles the cdk `Link`: an `<a>` with press, hover and focus states. `Link.Icon` adds a small trailing icon, by default the lucide `ArrowUpRight`. Port of HeroUI v3.2.6 [Link](https://www.heroui.com/docs/components/link).

## Import

```tsx
import { Link } from "@rivetjs/ui/link";
```

## Usage

```tsx
import { Link } from "@rivetjs/ui/link";

export default function Page() {
  return (
    <p>
      Read the{" "}
      <Link href="https://www.heroui.com/" target="_blank" rel="noreferrer">
        HeroUI docs
        <Link.Icon />
      </Link>
      .
    </p>
  );
}
```

## Variants

`linkVariants` has no variants: one `link` class on the anchor and `link__icon` on the icon. Pass `class` to extend either.

Props go to the cdk `Link`: `href`, `target`, `rel`, `download`, `ping`, `referrerPolicy`, `hrefLang`, `routerOptions`, `isDisabled`, `autoFocus`, `slot`, `ref`, `render`, and the events below.

## Parts

| Part | Element | `data-slot` |
| --- | --- | --- |
| `Link` / `Link.Root` | `a` | `link` |
| `Link.Icon` | `span` | `link-icon` (+ `data-default-icon="true"` when it shows the default icon) |

`Link.Icon` with children renders them instead of the default icon (`data-slot="link-default-icon"`, 9px). Outside a `Link` it renders with only your `class`.

## Accessibility

Behaviour comes from [cdk Link](site:cdk/components/link/): press events, `data-hovered`, `data-pressed`, `data-focused`, `data-focus-visible`, `data-current`, `data-disabled`. A disabled link gets `aria-disabled` and no `href`. Client-side navigation goes through the router when the page uses `@rivetjs/router`.

Events: `onPress`, `onPressStart`, `onPressEnd`, `onPressChange`, `onPressUp`, `onHoverStart`, `onHoverEnd`, `onHoverChange`, `onFocus`, `onBlur`, `onFocusChange`, `onKeyDown`, `onKeyUp`.

Render props (`class` or `children` as a function) receive accessors: `({ isCurrent }) => isCurrent()`.

## Differences from HeroUI React

- `class`, not `className`.
- `isDisabled` accepts a signal; the link is re-created when it flips.
- The default `Link.Icon` is lucide `ArrowUpRight` (stroked) instead of HeroUI's filled `ExternalLinkIcon`.
- Handlers must be inline arrows or local consts ([serializable captures](../../best-practices/serializable-captures.md)).
