---
title: Modal
description: "Dialog overlay for focused user interactions and important content"
template: reference
status: experimental
related: [components/button, components/tooltip]
---

`Modal` shows a dialog above the page and blocks interaction with everything behind it. The root is the [cdk DialogTrigger](site:cdk/components/dialog/): its first child (a [Button](button.md) or `Modal.Trigger`) opens `Modal.Content` (or the explicit `Modal.Backdrop` / `Modal.Container`), the [cdk ModalOverlay / Modal](site:cdk/components/modal/) on the shared div overlay layer, with a `Modal.Dialog` inside.

Notes:

- `class`, not `className`. `isOpen` on `Modal.Backdrop` (or the root) takes a signal (two-way: dismissing writes `false` back) or a read-only accessor with `onOpenChange`.
- `useOverlayState()` (from `@rivetjs/ui`) returns `isOpen` as an accessor (`state.isOpen()`), plus `open` / `close` / `toggle` / `setOpen`; pass the state to the root with `state={state}`.
- The modal renders in Rivet's div overlay layer (no native `<dialog>` / top layer); an open modal is in the server HTML.
- `UNSTABLE_portalContainer` is not supported: wrap the modal in the cdk `PortalProvider` with a `container` (selector, element or accessor) instead.
- `Modal.Content` (Rivet addition) = `Modal.Backdrop` + `Modal.Container` + `Modal.Dialog` + a `Modal.CloseTrigger`, same markup: `backdrop` is the Backdrop `variant`, the overlay props (`isOpen`, `isDismissable`, …) go to the Backdrop, `placement` / `scroll` / `size` to the Container, `class` and the rest to the Dialog; `closeButton={false}` drops the close button. Use the explicit parts to style the backdrop or container (`class` on them).
- `Modal.Header` wraps string children in a `Modal.Heading` (Rivet addition): `<Modal.Header>Welcome</Modal.Header>` labels the dialog.
- `Modal.Trigger` is a `div role="button"` made pressable by the cdk `Pressable` (render-function child internally).

Accessibility: `Modal.Dialog` has `role="dialog"` and is labelled by `Modal.Heading`. Focus moves into the dialog on open, stays trapped inside, and returns to the trigger on close. Escape and a backdrop press dismiss it unless disabled, and the page scroll is locked while it is open.

## Usage

```tsx
import { Modal } from "@rivetjs/ui/modal";
```

::example{id=modal-default}

## Anatomy

```tsx
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export default () => (
  <Modal>
    <Button>Open Modal</Button>
    <Modal.Content>
      {/* Backdrop + Container + Dialog + CloseTrigger (closeButton={false} drops it) */}
      <Modal.Header>
        <Modal.Icon /> {/* Optional: Icon */}
        <Modal.Heading />
      </Modal.Header>
      <Modal.Body />
      <Modal.Footer />
    </Modal.Content>
  </Modal>
);
```

The explicit parts stay available for a styled backdrop or container:

```tsx
<Modal>
  <Button>Open Modal</Button>
  <Modal.Backdrop>
    <Modal.Container>
      <Modal.Dialog>
        <Modal.CloseTrigger />
        <Modal.Header>
          <Modal.Heading />
        </Modal.Header>
        <Modal.Body />
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>
</Modal>
```

## Examples

### Sizes

::example{id=modal-sizes}

### Placement

::example{id=modal-placements}

### Scroll Behavior

::example{id=modal-scroll-comparison}

### Controlled State

::example{id=modal-controlled}

### With Form

::example{id=modal-with-form}

### Custom Trigger

::example{id=modal-custom-trigger}

### Backdrop Variants

::example{id=modal-backdrop-variants}

### Custom Backdrop

::example{id=modal-custom-backdrop}

### Dismiss Behavior

::example{id=modal-dismiss-behavior}

### Close Methods

::example{id=modal-close-methods}

### Custom Animations

::example{id=modal-custom-animations}

### Custom Portal

::example{id=modal-custom-portal}

## Customization

### Tailwind CSS

::example{id=modal-custom-styles}

### Global CSS

To customize the Modal component classes, you can use the `@layer components` directive.

[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .modal__backdrop {
    @apply bg-gradient-to-br from-black/50 to-black/70;
  }

  .modal__dialog {
    @apply rounded-2xl border border-white/10 shadow-2xl;
  }

  .modal__header {
    @apply text-center;
  }

  .modal__close-trigger {
    @apply rounded-full bg-white/10 hover:bg-white/20;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Modal component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/modal.css)):

#### Base Classes

- `.modal__trigger` - Trigger element that opens the modal
- `.modal__backdrop` - Overlay backdrop behind the modal
- `.modal__container` - Positioning wrapper with placement support
- `.modal__dialog` - Modal content container
- `.modal__header` - Header section for titles and icons
- `.modal__body` - Main content area
- `.modal__footer` - Footer section for actions
- `.modal__close-trigger` - Close button element

#### Backdrop Variants

- `.modal__backdrop--opaque` - Opaque colored backdrop (default)
- `.modal__backdrop--blur` - Blurred backdrop with glass effect
- `.modal__backdrop--transparent` - Transparent backdrop (no overlay)

#### Scroll Variants

- `.modal__container--scroll-outside` - Enables scrolling the entire modal
- `.modal__dialog--scroll-inside` - Constrains modal height for body scrolling
- `.modal__body--scroll-inside` - Makes only the body scrollable
- `.modal__body--scroll-outside` - Allows full-page scrolling

### Interactive States

The component supports these interactive states:

- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` - Applied to trigger, dialog, and close button
- **Hover**: `:hover` or `[data-hovered="true"]` - Applied to close button on hover
- **Active**: `:active` or `[data-pressed="true"]` - Applied to close button when pressed
- **Entering**: `[data-entering]` - Applied during modal opening animation
- **Exiting**: `[data-exiting]` - Applied during modal closing animation
- **Placement**: `[data-placement="*"]` - Applied based on modal position (auto, top, center, bottom)

## API Reference

### Modal

| Prop       | Type                    | Default | Description                                         |
| ---------- | ----------------------- | ------- | --------------------------------------------------- |
| `children` | `Content`               | -       | Trigger and container elements                      |
| `state`    | `UseOverlayStateReturn` | -       | State from `useOverlayState()` (controls the modal) |

### Modal.Trigger

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `children` | `Content` | -       | Custom trigger content |
| `class`    | `string`  | -       | CSS classes            |

### Modal.Backdrop

| Prop                        | Type                                          | Default    | Description                                 |
| --------------------------- | --------------------------------------------- | ---------- | ------------------------------------------- |
| `variant`                   | `"opaque" \| "blur" \| "transparent"`         | `"opaque"` | Backdrop overlay style                      |
| `isDismissable`             | `boolean`                                     | `true`     | Close on backdrop click                     |
| `isKeyboardDismissDisabled` | `boolean`                                     | `false`    | Disable ESC key to close                    |
| `isOpen`                    | `boolean \| Signal<boolean> \| () => boolean` | -          | Controlled open state (a signal is two-way) |
| `onOpenChange`              | `(isOpen: boolean) => void`                   | -          | Open state change handler                   |
| `class`                     | `string \| (values) => string`                | -          | Backdrop CSS classes                        |

### Modal.Container

| Prop        | Type                                                | Default    | Description              |
| ----------- | --------------------------------------------------- | ---------- | ------------------------ |
| `placement` | `"auto" \| "center" \| "top" \| "bottom"`           | `"auto"`   | Modal position on screen |
| `scroll`    | `"inside" \| "outside"`                             | `"inside"` | Scroll behavior          |
| `size`      | `"xs" \| "sm" \| "md" \| "lg" \| "cover" \| "full"` | `"md"`     | Modal size variant       |
| `class`     | `string \| (values) => string`                      | -          | Container CSS classes    |

### Modal.Dialog

| Prop               | Type                              | Default    | Description                |
| ------------------ | --------------------------------- | ---------- | -------------------------- |
| `children`         | `Content \| ({close}) => Content` | -          | Content or render function |
| `class`            | `string`                          | -          | CSS classes                |
| `role`             | `string`                          | `"dialog"` | ARIA role                  |
| `aria-label`       | `string`                          | -          | Accessibility label        |
| `aria-labelledby`  | `string`                          | -          | ID of label element        |
| `aria-describedby` | `string`                          | -          | ID of description element  |

### Modal.Content

Rivet addition: `Modal.Backdrop` + `Modal.Container` + `Modal.Dialog` (+ `Modal.CloseTrigger`).

| Prop                        | Type                                                | Default    | Description                                         |
| --------------------------- | --------------------------------------------------- | ---------- | --------------------------------------------------- |
| `backdrop`                  | `"opaque" \| "blur" \| "transparent"`               | `"opaque"` | Backdrop overlay style (`Modal.Backdrop` `variant`) |
| `closeButton`               | `boolean`                                           | `true`     | Render a `Modal.CloseTrigger` before the content    |
| `placement`                 | `"auto" \| "center" \| "top" \| "bottom"`           | `"auto"`   | Modal position on screen                            |
| `scroll`                    | `"inside" \| "outside"`                             | `"inside"` | Scroll behavior                                     |
| `size`                      | `"xs" \| "sm" \| "md" \| "lg" \| "cover" \| "full"` | `"md"`     | Modal size variant                                  |
| `isOpen`                    | `boolean \| Signal<boolean> \| () => boolean`       | -          | Controlled open state (a signal is two-way)         |
| `onOpenChange`              | `(isOpen: boolean) => void`                         | -          | Open state change handler                           |
| `isDismissable`             | `boolean`                                           | `true`     | Close on backdrop click                             |
| `isKeyboardDismissDisabled` | `boolean`                                           | `false`    | Disable ESC key to close                            |
| `class`                     | `string`                                            | -          | Dialog CSS classes                                  |
| `children`                  | `Content \| ({close}) => Content`                   | -          | Dialog content or render function                   |

### Modal.Header

| Prop       | Type      | Default | Description                                            |
| ---------- | --------- | ------- | ------------------------------------------------------ |
| `children` | `Content` | -       | Header content (a string renders in a `Modal.Heading`) |
| `class`    | `string`  | -       | CSS classes                                            |

### Modal.Body

| Prop       | Type      | Default | Description  |
| ---------- | --------- | ------- | ------------ |
| `children` | `Content` | -       | Body content |
| `class`    | `string`  | -       | CSS classes  |

### Modal.Footer

| Prop       | Type      | Default | Description    |
| ---------- | --------- | ------- | -------------- |
| `children` | `Content` | -       | Footer content |
| `class`    | `string`  | -       | CSS classes    |

### Modal.CloseTrigger

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
state.open(); // Open modal
state.close(); // Close modal
state.toggle(); // Toggle state
state.setOpen(true); // Set state directly
```

::api{symbol="@rivetjs/ui/modal#ModalContainerProps"}

## Accessibility

Implements [WAI-ARIA Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):

- **Focus trap**: Focus locked within modal
- **Keyboard**: `ESC` closes (when enabled), `Tab` cycles elements
- **Screen readers**: Proper ARIA attributes
- **Scroll lock**: Body scroll disabled when open

## Related Components

- [Button](/components/button/): Allows a user to perform an action.
- [Tooltip](/components/tooltip/): Contextual information on hover or focus.
- [Select](/components/select/): Dropdown select control.
