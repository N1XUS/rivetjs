---
title: Button
description: "@rivetjs/ui Button and CloseButton: HeroUI-styled buttons on the cdk Button, with variants, sizes, icon-only and pending render props."
template: reference
status: experimental
related: [ui/heroui-port, ui/components/link, ui/components/spinner]
---

`Button` is the HeroUI button on top of the accessible cdk `Button`. `CloseButton` is a small icon-only button with an `aria-label` of "Close". Both are 1:1 ports of HeroUI v3.2.6 ([Button](https://www.heroui.com/docs/components/button), [CloseButton](https://www.heroui.com/docs/components/close-button)).

## Import

```tsx
import { Button } from "@rivetjs/ui/button";
import { CloseButton } from "@rivetjs/ui/close-button";
```

## Usage

```tsx
import { Button } from "@rivetjs/ui/button";
import { Icon } from "@rivetjs/kit/icon";
import { Plus } from "lucide";

export default function Page() {
  return (
    <div class="flex gap-2">
      <Button onPress={() => console.log("pressed")}>Save</Button>
      <Button variant="secondary" size="sm">
        Cancel
      </Button>
      <Button variant="ghost" isIconOnly aria-label="Add">
        <Icon icon={Plus} size={16} />
      </Button>
      <Button variant="danger" isDisabled>
        Delete
      </Button>
    </div>
  );
}
```

### Pending state

The cdk button takes `isPending` as a boolean or a signal. The button has no built-in spinner (same as HeroUI); render one in a function child:

```tsx
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Spinner } from "@rivetjs/ui/spinner";

export default function Page() {
  const saving = signal(false);
  return (
    <Button
      isPending={saving}
      onPress={() => {
        saving.set(true);
        setTimeout(() => saving.set(false), 1000);
      }}
    >
      {({ isPending }) => (isPending() ? <Spinner size="sm" color="current" /> : "Save")}
    </Button>
  );
}
```

## Variants

`Button` (`buttonVariants`):

| Prop | Values | Default |
| --- | --- | --- |
| `variant` | `primary`, `secondary`, `tertiary`, `outline`, `ghost`, `danger`, `danger-soft` | `primary` |
| `size` | `sm`, `md`, `lg` | `md` |
| `isIconOnly` | `true` | `false` |
| `fullWidth` | `true` | `false` |

`CloseButton` (`closeButtonVariants`):

| Prop | Values | Default |
| --- | --- | --- |
| `variant` | `default` | `default` |

Other props go to the cdk `Button`: `isDisabled`, `isPending`, `type` (default `button`), `autoFocus`, `excludeFromTabOrder`, `preventFocusOnPress`, `form*` attributes, `name`, `value`, `slot`, `style`, `ref`, `render`, and the events below.

## Parts

| Part | Element | `data-slot` |
| --- | --- | --- |
| `Button` / `Button.Root` | `button` | `button` |
| `CloseButton` / `CloseButton.Root` | `button` (`type="button"`, `aria-label="Close"`) | `close-button` |

`CloseButton` renders the lucide `X` icon (16px, `data-slot="close-button-icon"`) when it has no children.

Inside a `ButtonGroup` (`@rivetjs/ui/button-group`), every `Button` reads `size`, `variant`, `isDisabled` and `fullWidth` from `ButtonGroupContext`; its own props win, and `{ [BUTTON_GROUP_CHILD]: false }` opts a Button out. HeroUI applies the group props to direct children only.

## Accessibility

Behaviour comes from [cdk Button](site:cdk/components/button/): press events that unify mouse, touch, keyboard and screen-reader activation; `data-hovered`, `data-pressed`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-pending` attributes; a pending button keeps focus, drops press and hover and is announced. Give an icon-only button an `aria-label`.

Events: `onPress`, `onPressStart`, `onPressEnd`, `onPressChange`, `onPressUp`, `onHoverStart`, `onHoverEnd`, `onHoverChange`, `onFocus`, `onBlur`, `onFocusChange`, `onKeyDown`, `onKeyUp`. Use `onPress`, not `onClick`.

Render props (`class` or `children` as a function) receive accessors: `({ isPressed }) => isPressed()`.

## Differences from HeroUI React

- `class`, not `className`. A function `class` gets accessor render props.
- `isDisabled` and `isPending` accept a signal; the button updates without being re-created.
- Handlers must be inline arrows or local consts ([serializable captures](../../best-practices/serializable-captures.md)).
- `CloseButton`'s icon is lucide `X` (stroked) instead of HeroUI's filled glyph.
- A `Button` loads its resume chunk on page load (unlike markup-only components such as `Card`).
