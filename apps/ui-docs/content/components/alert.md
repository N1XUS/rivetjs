---
title: Alert
description: "Display important messages and notifications to users with status indicators."
template: reference
status: experimental
related: [components/close-button, components/button, components/spinner]
---

`Alert` shows a short message with a status color and icon. Parts: `Alert.Indicator`, `Alert.Content`, `Alert.Title`, `Alert.Description`.

Notes:

- `class`, not `className`.
- Default icons are lucide (stroked).
- Any `Alert.Indicator` child replaces the default icon; omit children to keep it.

Accessibility: Alert is markup without cdk behaviour and adds no `role`. For a message that appears after an action, set `role="alert"` (urgent) or `role="status"` (polite) on the root.

## Usage

```tsx
import { Alert } from "@rivetjs/ui/alert";
```

::example{id=alert-basic}

## Anatomy

```tsx
import { Alert } from "@rivetjs/ui/alert";

export default () => (
  <Alert>
    <Alert.Indicator />
    <Alert.Content>
      <Alert.Title />
      <Alert.Description />
    </Alert.Content>
  </Alert>
);
```

## Customization

### Tailwind CSS

::example{id=alert-custom-styles}

### Global CSS

To customize the Alert component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .alert {
    @apply rounded-2xl shadow-lg;
  }

  .alert__title {
    @apply font-bold text-lg;
  }

  .alert--danger {
    @apply border-l-4 border-red-600;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Alert component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/alert.css)):

#### Base Classes

- `.alert` - Base alert container
- `.alert__indicator` - Icon/indicator container
- `.alert__content` - Content wrapper for title and description
- `.alert__title` - Alert title text
- `.alert__description` - Alert description text

#### Status Variant Classes

- `.alert--default` - Default gray status
- `.alert--accent` - Accent blue status
- `.alert--success` - Success green status
- `.alert--warning` - Warning yellow/orange status
- `.alert--danger` - Danger red status

### Interactive States

The Alert component is primarily informational and doesn't have interactive states on the base component. However, it can contain interactive elements like buttons or close buttons.

## API Reference

### Alert

| Prop       | Type                                                          | Default     | Description                    |
| ---------- | ------------------------------------------------------------- | ----------- | ------------------------------ |
| `status`   | `"default" \| "accent" \| "success" \| "warning" \| "danger"` | `"default"` | The visual status of the alert |
| `class`    | `string`                                                      | -           | Additional CSS classes         |
| `children` | `Content`                                                     | -           | The alert content              |

### Alert.Indicator

| Prop       | Type      | Default | Description                                     |
| ---------- | --------- | ------- | ----------------------------------------------- |
| `class`    | `string`  | -       | Additional CSS classes                          |
| `children` | `Content` | -       | Custom indicator icon (defaults to status icon) |

### Alert.Content

| Prop       | Type      | Default | Description                               |
| ---------- | --------- | ------- | ----------------------------------------- |
| `class`    | `string`  | -       | Additional CSS classes                    |
| `children` | `Content` | -       | Content (typically Title and Description) |

### Alert.Title

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `class`    | `string`  | -       | Additional CSS classes |
| `children` | `Content` | -       | The alert title text   |

### Alert.Description

| Prop       | Type      | Default | Description                |
| ---------- | --------- | ------- | -------------------------- |
| `class`    | `string`  | -       | Additional CSS classes     |
| `children` | `Content` | -       | The alert description text |

::api{symbol="@rivetjs/ui/alert#AlertRootProps"}

## Related Components

- [CloseButton](/components/close-button/): Button for dismissing overlays.
- [Button](/components/button/): Allows a user to perform an action.
- [Spinner](/components/spinner/): Loading indicator.
