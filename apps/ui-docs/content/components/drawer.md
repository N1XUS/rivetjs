---
title: Drawer
description: "Slide-out panel for supplementary content and actions"
template: reference
status: experimental
related: [components/modal, components/button, components/close-button, components/alert-dialog]
---

`Drawer` slides a panel in from an edge of the screen. The root is the [cdk DialogTrigger](site:cdk/components/dialog/): its first child (a [Button](button.md) or `Drawer.Trigger`) opens `Drawer.Content` (or the explicit `Drawer.Backdrop` / `Drawer.Container`), the [cdk ModalOverlay / Modal](site:cdk/components/modal/) on the shared div overlay layer, with a `Drawer.Dialog` inside. A dismissable drawer can be dragged towards its edge to close it.

Notes:

- `class`, not `className`. `isOpen` on `Drawer.Backdrop` takes a signal (two-way: dismissing writes `false` back) or a read-only accessor with `onOpenChange`.
- `Drawer.Content` folds the wrappers (Rivet): it is `Drawer.Backdrop` + `Drawer.Container` + `Drawer.Dialog` + a `Drawer.CloseTrigger`, same markup (`closeButton={false}` drops the close button). The sliding container is `Drawer.Container` (same `drawer__content` class and `data-slot`). `placement` goes on the root (`<Drawer placement="right">`, read once); a `placement` on `Drawer.Content` / `Drawer.Container` wins and is live. `backdrop` is the Backdrop `variant`; the overlay props (`isOpen`, `isDismissable`, …) go to the Backdrop, `class` and the rest to the Dialog.
- `Drawer.Header` wraps string children in a `Drawer.Heading` (Rivet): `<Drawer.Header>Cart</Drawer.Header>` labels the dialog.
- `useOverlayState()` (from `@rivetjs/ui`) returns `isOpen` as an accessor (`state.isOpen()`), plus `open` / `close` / `toggle` / `setOpen`; pass the state to the root with `state={state}`.
- The drawer renders in Rivet's div overlay layer (no native `<dialog>` / top layer); an open drawer is in the server HTML.
- Drag to dismiss: from the handle, header or footer only; past 30 % of the panel or a fast flick closes it). While dragging and when it settles back, the panel moves on the Rivet motion physics (`@rivetjs/cdk/motion`) instead of a CSS transition; `prefers-reduced-motion` makes the settle jump. Enter and exit animations are CSS.

Accessibility: `Drawer.Dialog` has `role="dialog"` and is labelled by `Drawer.Heading`. Focus moves into the drawer on open, stays trapped inside, and returns to the trigger on close. Escape and a backdrop press dismiss it unless disabled, and the page scroll is locked while it is open.

## Usage

```tsx
import { Drawer } from "@rivetjs/ui/drawer";
```

::example{id=drawer-basic}

## Anatomy

```tsx
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";

export default () => (
  <Drawer placement="right">
    <Button>Open Drawer</Button>
    <Drawer.Content>
      {/* Backdrop + Container + Dialog + CloseTrigger (closeButton={false} drops it) */}
      <Drawer.Handle /> {/* Optional: Drag handle */}
      <Drawer.Header>
        <Drawer.Heading />
      </Drawer.Header>
      <Drawer.Body />
      <Drawer.Footer />
    </Drawer.Content>
  </Drawer>
);
```

The explicit parts stay available for a styled backdrop or container:

```tsx
<Drawer>
  <Button>Open Drawer</Button>
  <Drawer.Backdrop>
    <Drawer.Container placement="right">
      <Drawer.Dialog>
        <Drawer.CloseTrigger />
        <Drawer.Header>
          <Drawer.Heading />
        </Drawer.Header>
        <Drawer.Body />
      </Drawer.Dialog>
    </Drawer.Container>
  </Drawer.Backdrop>
</Drawer>
```

## Examples

### Placement

::example{id=drawer-placements}

### Non-Dismissable

Set `isDismissable={false}` on `Drawer.Backdrop` to prevent closing by clicking outside or dragging. The user must interact with the drawer's action buttons.

::example{id=drawer-non-dismissable}

### Scrollable Content

The `Drawer.Body` automatically handles overflow with native scrolling. Drag-to-dismiss is excluded from the body area to avoid scroll conflicts.

::example{id=drawer-scrollable-content}

### Controlled State

::example{id=drawer-controlled}

### With Form

::example{id=drawer-with-form}

### Navigation Drawer

::example{id=drawer-navigation}

### Backdrop Variants

::example{id=drawer-backdrop-variants}

## Customization

### Tailwind CSS

::example{id=drawer-custom-styles}

### Global CSS

To customize the Drawer component classes, you can use the `@layer components` directive.

[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .drawer__backdrop {
    @apply bg-gradient-to-br from-black/50 to-black/70;
  }

  .drawer__dialog {
    @apply rounded-2xl border border-white/10 shadow-2xl;
  }

  .drawer__header {
    @apply text-center;
  }

  .drawer__close-trigger {
    @apply rounded-full bg-white/10 hover:bg-white/20;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Drawer component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/drawer.css)):

#### Base Classes

- `.drawer__trigger` - Trigger element that opens the drawer
- `.drawer__backdrop` - Overlay backdrop behind the drawer
- `.drawer__content` - Positioning wrapper for the drawer panel
- `.drawer__dialog` - The drawer panel itself
- `.drawer__header` - Header section for titles
- `.drawer__heading` - Main title text
- `.drawer__body` - Main scrollable content area
- `.drawer__footer` - Footer section for actions
- `.drawer__handle` - Visual drag handle indicator
- `.drawer__close-trigger` - Close button element

#### Backdrop Variants

- `.drawer__backdrop--opaque` - Opaque colored backdrop (default)
- `.drawer__backdrop--blur` - Blurred backdrop with glass effect
- `.drawer__backdrop--transparent` - Transparent backdrop (no overlay)

#### Placement Variants

- `.drawer__content--bottom` - Slides up from the bottom edge (default)
- `.drawer__content--top` - Slides down from the top edge
- `.drawer__content--left` - Slides in from the left edge
- `.drawer__content--right` - Slides in from the right edge

#### Dialog Variants

- `.drawer__dialog--top` - Slides down from the top edge
- `.drawer__dialog--bottom` - Slides up from the bottom edge
- `.drawer__dialog--left` - Slides in from the left edge
- `.drawer__dialog--right` - Slides in from the right edge

### Interactive States

The component supports these interactive states:

- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` - Applied to trigger and close button
- **Hover**: `:hover` or `[data-hovered="true"]` - Applied to close button on hover
- **Active**: `:active` or `[data-pressed="true"]` - Applied to trigger and close button when pressed
- **Entering**: `[data-entering]` - Applied during drawer opening animation
- **Exiting**: `[data-exiting]` - Applied during drawer closing animation
- **Placement**: `[data-placement="*"]` - Applied based on drawer position (top, bottom, left, right)

## API Reference

### Drawer

| Prop        | Type                                     | Default    | Description                                    |
| ----------- | ---------------------------------------- | ---------- | ---------------------------------------------- |
| `children`  | `Content`                                | -          | Trigger and backdrop elements                  |
| `state`     | `UseOverlayStateReturn`                  | -          | Controlled overlay state                       |
| `placement` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` | Edge the drawer slides from (Rivet; read once) |

### Drawer.Trigger

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `children` | `Content` | -       | Custom trigger content |
| `class`    | `string`  | -       | CSS classes            |

### Drawer.Backdrop

| Prop                        | Type                                          | Default    | Description                                 |
| --------------------------- | --------------------------------------------- | ---------- | ------------------------------------------- |
| `variant`                   | `"opaque" \| "blur" \| "transparent"`         | `"opaque"` | Backdrop overlay style                      |
| `isDismissable`             | `boolean`                                     | `true`     | Close on backdrop click                     |
| `isKeyboardDismissDisabled` | `boolean`                                     | `false`    | Disable ESC key to close                    |
| `isOpen`                    | `boolean \| Signal<boolean> \| () => boolean` | -          | Controlled open state (a signal is two-way) |
| `onOpenChange`              | `(isOpen: boolean) => void`                   | -          | Open state change handler                   |
| `class`                     | `string \| (values) => string`                | -          | Backdrop CSS classes                        |

### Drawer.Content

Rivet: `Drawer.Backdrop` + `Drawer.Container` + `Drawer.Dialog` (+ `Drawer.CloseTrigger`).

| Prop                        | Type                                          | Default                     | Description                                          |
| --------------------------- | --------------------------------------------- | --------------------------- | ---------------------------------------------------- |
| `placement`                 | `"top" \| "bottom" \| "left" \| "right"`      | the root's, else `"bottom"` | Edge the drawer slides from                          |
| `backdrop`                  | `"opaque" \| "blur" \| "transparent"`         | `"opaque"`                  | Backdrop overlay style (`Drawer.Backdrop` `variant`) |
| `closeButton`               | `boolean`                                     | `true`                      | Render a `Drawer.CloseTrigger` before the content    |
| `isOpen`                    | `boolean \| Signal<boolean> \| () => boolean` | -                           | Controlled open state (a signal is two-way)          |
| `onOpenChange`              | `(isOpen: boolean) => void`                   | -                           | Open state change handler                            |
| `isDismissable`             | `boolean`                                     | `true`                      | Close on backdrop click (and drag to dismiss)        |
| `isKeyboardDismissDisabled` | `boolean`                                     | `false`                     | Disable ESC key to close                             |
| `class`                     | `string`                                      | -                           | Dialog CSS classes                                   |
| `children`                  | `Content \| ({close}) => Content`             | -                           | Dialog content or render function                    |

### Drawer.Container

The sliding container (class `drawer__content`).

| Prop        | Type                                     | Default                     | Description                 |
| ----------- | ---------------------------------------- | --------------------------- | --------------------------- |
| `placement` | `"top" \| "bottom" \| "left" \| "right"` | the root's, else `"bottom"` | Edge the drawer slides from |
| `class`     | `string \| (values) => string`           | -                           | Container CSS classes       |

### Drawer.Dialog

| Prop              | Type      | Default    | Description         |
| ----------------- | --------- | ---------- | ------------------- |
| `children`        | `Content` | -          | Dialog content      |
| `class`           | `string`  | -          | CSS classes         |
| `role`            | `string`  | `"dialog"` | ARIA role           |
| `aria-label`      | `string`  | -          | Accessibility label |
| `aria-labelledby` | `string`  | -          | ID of label element |

### Drawer.Header

| Prop       | Type      | Default | Description    |
| ---------- | --------- | ------- | -------------- |
| `children` | `Content` | -       | Header content |
| `class`    | `string`  | -       | CSS classes    |

### Drawer.Heading

| Prop       | Type      | Default | Description |
| ---------- | --------- | ------- | ----------- |
| `children` | `Content` | -       | Title text  |
| `class`    | `string`  | -       | CSS classes |

### Drawer.Body

| Prop       | Type      | Default | Description  |
| ---------- | --------- | ------- | ------------ |
| `children` | `Content` | -       | Body content |
| `class`    | `string`  | -       | CSS classes  |

### Drawer.Footer

| Prop       | Type      | Default | Description    |
| ---------- | --------- | ------- | -------------- |
| `children` | `Content` | -       | Footer content |
| `class`    | `string`  | -       | CSS classes    |

### Drawer.Handle

| Prop    | Type     | Default | Description |
| ------- | -------- | ------- | ----------- |
| `class` | `string` | -       | CSS classes |

### Drawer.CloseTrigger

| Prop       | Type                           | Default | Description         |
| ---------- | ------------------------------ | ------- | ------------------- |
| `children` | `Content`                      | -       | Custom close button |
| `class`    | `string \| (values) => string` | -       | CSS classes         |

### useOverlayState Hook

```tsx
import { useOverlayState } from "@rivetjs/ui";

const state = useOverlayState({
  defaultOpen: false,
  onOpenChange: (isOpen) => console.log(isOpen),
});

state.isOpen(); // Current state
state.open(); // Open drawer
state.close(); // Close drawer
state.toggle(); // Toggle state
state.setOpen(true); // Set state directly
```

::api{symbol="@rivetjs/ui/drawer#DrawerContentProps"}

## Accessibility

Implements [WAI-ARIA Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):

- **Focus trap**: Focus locked within drawer when open
- **Keyboard**: `ESC` closes (when dismissable), `Tab` cycles elements
- **Screen readers**: Proper ARIA attributes via the cdk dialog
- **Scroll lock**: Body scroll disabled when open
- **Drag to dismiss**: Supports pointer-based drag gestures on handle, header, and footer areas

## Related Components

- [Modal](/components/modal/): Dialog overlay for focused user interactions.
- [Button](/components/button/): Allows a user to perform an action.
- [CloseButton](/components/close-button/): Button for dismissing overlays.
- [AlertDialog](/components/alert-dialog/): Modal dialog for critical confirmations.
