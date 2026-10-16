---
title: AlertDialog
description: "Modal dialog for critical confirmations requiring user attention and explicit action"
template: reference
status: experimental
related: [components/modal, components/button, components/close-button]
---

`AlertDialog` asks for a decision before the user can continue. The root is the [cdk DialogTrigger](site:cdk/components/dialog/): its first child (a [Button](button.md) or `AlertDialog.Trigger`) opens `AlertDialog.Backdrop` / `AlertDialog.Container`, the [cdk ModalOverlay / Modal](site:cdk/components/modal/) on the shared div overlay layer, with an `AlertDialog.Dialog` (`role="alertdialog"`) inside. Same structure as [Modal](modal.md), but dismissing needs an explicit action by default.

Notes:

- `class`, not `className`. `isOpen` on `AlertDialog.Backdrop` takes a signal (two-way: closing writes `false` back) or a read-only accessor with `onOpenChange`.
- `useOverlayState()` (from `@rivetjs/ui`) returns `isOpen` as an accessor (`state.isOpen()`), plus `open` / `close` / `toggle` / `setOpen`.
- The dialog renders in Rivet's div overlay layer (no native `<dialog>` / top layer); an open dialog is in the server HTML.
- `UNSTABLE_portalContainer` is not supported: wrap the dialog in the cdk `PortalProvider` with a `container` (selector, element or accessor) instead.
- `AlertDialog.Icon` default icons are lucide (`Info`, `CircleCheck`, `TriangleAlert`, `CircleAlert`).

Accessibility: `AlertDialog.Dialog` has `role="alertdialog"` and is labelled by `AlertDialog.Heading`. Focus moves into the dialog on open, stays trapped inside, and returns to the trigger on close. Backdrop press and Escape do not dismiss it unless enabled (`isDismissable`, `isKeyboardDismissDisabled={false}`), and the page scroll is locked while it is open.

## Usage

```tsx
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
```

::example{id=alert-dialog-default}

## Anatomy

```tsx
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export default () => (
  <AlertDialog>
    <Button>Open Alert Dialog</Button>
    <AlertDialog.Backdrop>
      <AlertDialog.Container>
        <AlertDialog.Dialog>
          <AlertDialog.CloseTrigger /> {/* Optional: Close button */}
          <AlertDialog.Header>
            <AlertDialog.Icon /> {/* Optional: Status icon */}
            <AlertDialog.Heading />
          </AlertDialog.Header>
          <AlertDialog.Body />
          <AlertDialog.Footer />
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  </AlertDialog>
);
```

## Examples

### Statuses

::example{id=alert-dialog-statuses}

### Placements

::example{id=alert-dialog-placements}

### Sizes

::example{id=alert-dialog-sizes}

### Controlled State

::example{id=alert-dialog-controlled}

### Custom Icon

::example{id=alert-dialog-custom-icon}

### Custom Trigger

::example{id=alert-dialog-custom-trigger}

### Backdrop Variants

::example{id=alert-dialog-backdrop-variants}

### Custom Backdrop

::example{id=alert-dialog-custom-backdrop}

### Dismiss Behavior

::example{id=alert-dialog-dismiss-behavior}

### Close Methods

::example{id=alert-dialog-close-methods}

### Custom Animations

::example{id=alert-dialog-custom-animations}

### Custom Portal

::example{id=alert-dialog-custom-portal}

## Customization

### Tailwind CSS

::example{id=alert-dialog-custom-styles}

### Global CSS

To customize the AlertDialog component classes, you can use the `@layer components` directive.

[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .alert-dialog__backdrop {
    @apply bg-gradient-to-br from-black/60 to-black/80;
  }

  .alert-dialog__dialog {
    @apply rounded-2xl border border-red-500/20 shadow-2xl;
  }

  .alert-dialog__header {
    @apply gap-4;
  }

  .alert-dialog__icon {
    @apply size-16;
  }

  .alert-dialog__close-trigger {
    @apply rounded-full bg-white/10 hover:bg-white/20;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The AlertDialog component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/alert-dialog.css)):

#### Base Classes

- `.alert-dialog__trigger` - Trigger element that opens the alert dialog
- `.alert-dialog__backdrop` - Overlay backdrop behind the dialog
- `.alert-dialog__container` - Positioning wrapper with placement support
- `.alert-dialog__dialog` - Dialog content container
- `.alert-dialog__header` - Header section for icon and title
- `.alert-dialog__heading` - Heading text styles
- `.alert-dialog__body` - Main content area
- `.alert-dialog__footer` - Footer section for actions
- `.alert-dialog__icon` - Icon container with status colors
- `.alert-dialog__close-trigger` - Close button element

#### Backdrop Variants

- `.alert-dialog__backdrop--opaque` - Opaque colored backdrop (default)
- `.alert-dialog__backdrop--blur` - Blurred backdrop with glass effect
- `.alert-dialog__backdrop--transparent` - Transparent backdrop (no overlay)

#### Status Variants (Icon)

- `.alert-dialog__icon--default` - Default gray status
- `.alert-dialog__icon--accent` - Accent blue status
- `.alert-dialog__icon--success` - Success green status
- `.alert-dialog__icon--warning` - Warning orange status
- `.alert-dialog__icon--danger` - Danger red status

### Interactive States

The component supports these interactive states:

- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` - Applied to trigger, dialog, and close button
- **Hover**: `:hover` or `[data-hovered="true"]` - Applied to close button on hover
- **Active**: `:active` or `[data-pressed="true"]` - Applied to close button when pressed
- **Entering**: `[data-entering]` - Applied during dialog opening animation
- **Exiting**: `[data-exiting]` - Applied during dialog closing animation
- **Placement**: `[data-placement="*"]` - Applied based on dialog position (auto, top, center, bottom)

## API Reference

### AlertDialog

| Prop       | Type      | Default | Description                    |
| ---------- | --------- | ------- | ------------------------------ |
| `children` | `Content` | -       | Trigger and container elements |

### AlertDialog.Trigger

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `children` | `Content` | -       | Custom trigger content |
| `class`    | `string`  | -       | CSS classes            |

### AlertDialog.Backdrop

| Prop                        | Type                                          | Default    | Description                                 |
| --------------------------- | --------------------------------------------- | ---------- | ------------------------------------------- |
| `variant`                   | `"opaque" \| "blur" \| "transparent"`         | `"opaque"` | Backdrop overlay style                      |
| `isDismissable`             | `boolean`                                     | `false`    | Close on backdrop click                     |
| `isKeyboardDismissDisabled` | `boolean`                                     | `true`     | Disable ESC key to close                    |
| `isOpen`                    | `boolean \| Signal<boolean> \| () => boolean` | -          | Controlled open state (a signal is two-way) |
| `onOpenChange`              | `(isOpen: boolean) => void`                   | -          | Open state change handler                   |
| `class`                     | `string \| (values) => string`                | -          | Backdrop CSS classes                        |

### AlertDialog.Container

| Prop        | Type                                      | Default  | Description               |
| ----------- | ----------------------------------------- | -------- | ------------------------- |
| `placement` | `"auto" \| "center" \| "top" \| "bottom"` | `"auto"` | Dialog position on screen |
| `size`      | `"xs" \| "sm" \| "md" \| "lg" \| "cover"` | `"md"`   | Alert Dialog size variant |
| `class`     | `string \| (values) => string`            | -        | Container CSS classes     |

### AlertDialog.Dialog

| Prop               | Type                              | Default         | Description                |
| ------------------ | --------------------------------- | --------------- | -------------------------- |
| `children`         | `Content \| ({close}) => Content` | -               | Content or render function |
| `class`            | `string`                          | -               | CSS classes                |
| `role`             | `string`                          | `"alertdialog"` | ARIA role                  |
| `aria-label`       | `string`                          | -               | Accessibility label        |
| `aria-labelledby`  | `string`                          | -               | ID of label element        |
| `aria-describedby` | `string`                          | -               | ID of description element  |

### AlertDialog.Header

| Prop       | Type      | Default | Description                                 |
| ---------- | --------- | ------- | ------------------------------------------- |
| `children` | `Content` | -       | Header content (typically Icon and Heading) |
| `class`    | `string`  | -       | CSS classes                                 |

### AlertDialog.Heading

| Prop       | Type      | Default | Description  |
| ---------- | --------- | ------- | ------------ |
| `children` | `Content` | -       | Heading text |
| `class`    | `string`  | -       | CSS classes  |

### AlertDialog.Body

| Prop       | Type      | Default | Description  |
| ---------- | --------- | ------- | ------------ |
| `children` | `Content` | -       | Body content |
| `class`    | `string`  | -       | CSS classes  |

### AlertDialog.Footer

| Prop       | Type      | Default | Description                               |
| ---------- | --------- | ------- | ----------------------------------------- |
| `children` | `Content` | -       | Footer content (typically action buttons) |
| `class`    | `string`  | -       | CSS classes                               |

### AlertDialog.Icon

| Prop       | Type                                                          | Default    | Description          |
| ---------- | ------------------------------------------------------------- | ---------- | -------------------- |
| `children` | `Content`                                                     | -          | Custom icon element  |
| `status`   | `"default" \| "accent" \| "success" \| "warning" \| "danger"` | `"danger"` | Status color variant |
| `class`    | `string`                                                      | -          | CSS classes          |

### AlertDialog.CloseTrigger

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
state.open(); // Open dialog
state.close(); // Close dialog
state.toggle(); // Toggle state
state.setOpen(true); // Set state directly
```

::api{symbol="@rivetjs/ui/alert-dialog#AlertDialogContainerProps"}

## Accessibility

Implements [WAI-ARIA AlertDialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/):

- **Focus trap**: Focus locked within alert dialog
- **Keyboard**: `ESC` closes (when enabled), `Tab` cycles elements
- **Screen readers**: Proper ARIA attributes with `role="alertdialog"`
- **Scroll lock**: Body scroll disabled when open
- **Required action**: Defaults to requiring explicit user action (no backdrop/ESC dismiss)

## Related Components

- [Button](/components/button/): Allows a user to perform an action.
- [CloseButton](/components/close-button/): Button for dismissing overlays.
