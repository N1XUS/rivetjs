---
title: ComboBox
description: "A combo box combines a text input with a listbox, allowing users to filter a list of options to items matching a query."
template: reference
status: experimental
related: [components/list-box, components/input, components/popover]
---

`ComboBox` combines a text input with a list of options the user can filter by typing. It wraps the [cdk ComboBox](site:cdk/components/combobox/): `ComboBox.InputGroup` is a cdk `Group`, `ComboBox.Trigger` a cdk `Button`, `ComboBox.Popover` a cdk `Popover`, the text field is the ui [Input](/components/input/) (it takes the ComboBox `variant`) and the options are a [ListBox](/components/list-box/).

Notes:

- `class`, not `className`. `selectedKey` / `value` / `inputValue` take a signal (two-way) or a value; render props are accessors (`({ isOpen }) => isOpen() ? … : …`).
- `ComboBox.InputGroup` is the group element itself around its children: same markup for the usual `Input` + `Trigger` composition.
- The default trigger icon is a CSS morph chevron (`span.morph-chevron`, see [Indicator](#indicator)).
- The asynchronous demo uses the cdk `createAsyncList` (react-stately `useAsyncList` port).

## Usage

```tsx
import { ComboBox } from "@rivetjs/ui/combo-box";
```

::example{id=combo-box-default}

## Anatomy

```tsx
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Description } from "@rivetjs/ui/description";
import { Header } from "@rivetjs/ui/header";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Separator } from "@rivetjs/ui/separator";

export default () => (
  <ComboBox>
    <Label />
    <ComboBox.InputGroup>
      <Input />
      <ComboBox.Trigger />
    </ComboBox.InputGroup>
    {/* Displays the selected values, primarily used for multiple selection */}
    <ComboBox.Value />
    <Description />
    <ComboBox.Popover>
      <ListBox>
        <ListBox.Item>
          <Label />
          <Description />
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Section>
          <Header />
          <ListBox.Item>
            <Label />
          </ListBox.Item>
        </ListBox.Section>
      </ListBox>
    </ComboBox.Popover>
  </ComboBox>
);
```

Additional exported parts: `ComboBox.Root`.

## Examples

### Shorthand

Rivet addition: give the root a `label`, `placeholder`, `description`, `errorMessage` (or `items`) and only `ComboBox.Item` children; the Label, the input group (input + trigger), the popover with the list, the Description and the FieldError are rendered for you with the compound form's markup. With `items`, `children` is a render function of one item. `ComboBox.Item` adds the selection indicator and takes its `textValue` from string children. Use the compound parts for sections, a custom indicator or extra input-group content. Children do not switch the shorthand off: in the shorthand form they are the list content (the items, or the render function of one item), so `label` + children is the normal case and never warns.

With compound parts next to `items` the compound form renders and its `ListBox` takes the root's `items` (as in React Aria). `ComboBox.Item` keeps a `{expr}` child live (the option text follows its signals); `items` is live too (appended / removed items update the open list). The form is decided once, at render: adding or removing `label` / `placeholder` / `description` / `errorMessage` / `items` later does not switch it.

::example{id=combo-box-shorthand}

### Full Width

::example{id=combo-box-full-width}

### With Description

::example{id=combo-box-with-description}

### Required

::example{id=combo-box-required}

### Disabled

::example{id=combo-box-disabled}

### With Disabled Options

::example{id=combo-box-with-disabled-options}

### With Sections

::example{id=combo-box-with-sections}

### Controlled

::example{id=combo-box-controlled}

### Controlled Input Value

::example{id=combo-box-controlled-input-value}

### Asynchronous Loading

::example{id=combo-box-asynchronous-loading}

### Default Selected Key

::example{id=combo-box-default-selected-key}

### Allows Custom Value

::example{id=combo-box-allows-custom-value}

### Indicator

The default `ComboBox.Trigger` icon is a morph chevron: two CSS bars drawn like lucide `ChevronDown` that flatten into a line and fold up while the list is open (320 ms, the timing of apple.com's navigation chevron). It is CSS on the `data-open` attribute: no JavaScript, nothing plays on page load, and a toggle halfway reverses from the current shape. Reduced motion swaps it at once.

::example{id=combo-box-indicator}

Style hooks, on the ComboBox or any ancestor (Tailwind: `[--combo-box-indicator-size:20px]`):

| Variable                         | Default                                  |                                      |
| -------------------------------- | ---------------------------------------- | ------------------------------------ |
| `--combo-box-indicator-size`     | `1rem`                                   | Box size; the chevron scales with it |
| `--combo-box-indicator-stroke`   | size / 12                                | Bar thickness                        |
| `--combo-box-indicator-duration` | `var(--duration-morph-chevron)` (320 ms) | `0s` turns the morph off             |

Theme tokens for every morph chevron: `--duration-morph-chevron`, `--ease-morph-chevron-open`, `--ease-morph-chevron-close`. Trigger children replace the morph (next section) and are yours to animate, e.g. with `.combo-box__trigger[data-open="true"] svg`.

### Custom Indicator

::example{id=combo-box-custom-indicator}

### Custom Value

::example{id=combo-box-custom-value}

### Custom Filtering

::example{id=combo-box-custom-filtering}

### Render Function

::example{id=combo-box-render-function}

### Menu Trigger

Use the `menuTrigger` prop to control when the popover opens:

- `focus` (default): popover opens when the user focuses the input
- `input`: popover opens when the user edits the input text
- `manual`: popover only opens when the user presses the trigger button or uses the arrow keys

::example{id=combo-box-menu-trigger}

### Form Value

Use the `formValue` prop to control whether the selected item's key or text is submitted in forms. `key` is the default. When `allowsCustomValue` is true, the text is always submitted.

::example{id=combo-box-form-value}

### Validation Behavior

Use the `validationBehavior` prop to control how validation is displayed:

- `native` (default): blocks form submission when the value is missing or invalid
- `aria`: shows errors in realtime and does not block submission

::example{id=combo-box-validation-behavior}

### Custom Validation

Use the `validate` prop to return an error message when the value is invalid, or `true` when it is valid.

::example{id=combo-box-custom-validation}

### Read Only

Use the `isReadOnly` prop to make the ComboBox read-only. The selected value can be focused, but it cannot be changed.

::example{id=combo-box-read-only}

### Multiple Selection

Set `selectionMode="multiple"` to allow selecting more than one option. In multiple selection mode, use `ComboBox.Value` to display the selected items and pass `selectionMode="multiple"` to the inner `ListBox` as well. Selection is controlled with the `value` / `defaultValue` (`Key[]`) props and the `onChange` handler.

::example{id=combo-box-multiple-selection}

### In Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=combo-box-on-surface}

## Customization

### Tailwind CSS

::example{id=combo-box-custom-styles}

### Global CSS

To customize the ComboBox component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .combo-box {
    @apply flex flex-col gap-1;
  }

  .combo-box__input-group {
    @apply relative inline-flex items-center;
  }

  .combo-box__trigger {
    @apply absolute right-0 text-muted;
  }

  .combo-box__popover {
    @apply rounded-lg border border-border bg-surface p-2;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `combo-box-input-group`, `combo-box-value`, `combo-box-trigger`, `combo-box-trigger-default-icon`, `combo-box-popover`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ComboBox component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/combo-box.css)):

#### Base Classes

- `.combo-box` - Base ComboBox container
- `.combo-box__input-group` - Container for the input and trigger button
- `.combo-box__value` - The selected value display (used in multiple selection)
- `.combo-box__trigger` - The button that triggers the popover
- `.combo-box__popover` - The popover container

#### State Classes

- `.combo-box[data-invalid="true"]` - Invalid state
- `.combo-box[data-disabled="true"]` - Disabled ComboBox state
- `.combo-box__trigger[data-focus-visible="true"]` - Focused trigger state
- `.combo-box__trigger[data-disabled="true"]` - Disabled trigger state
- `.combo-box__trigger[data-open="true"]` - Open trigger state

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]` on trigger
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on trigger
- **Disabled**: `:disabled` or `[data-disabled="true"]` on ComboBox
- **Open**: `[data-open="true"]` on trigger

## API Reference

See the [full module API](/api/rivetjs/ui/combo-box/) for every named export and part prop type.

### ComboBox

| Prop                    | Type                                                                               | Default     | Description                                                                                                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inputValue`            | `string`                                                                           | -           | Current input value (controlled)                                                                                                                                                                                                         |
| `defaultInputValue`     | `string`                                                                           | -           | Default input value (uncontrolled)                                                                                                                                                                                                       |
| `onInputChange`         | `(value: string) => void`                                                          | -           | Handler called when the input value changes                                                                                                                                                                                              |
| `selectionMode`         | `"single" \| "multiple"`                                                           | `"single"`  | Whether single or multiple selection is enabled                                                                                                                                                                                          |
| `selectedKey`           | `Key \| null`                                                                      | -           | Current selected key (controlled, single selection)                                                                                                                                                                                      |
| `defaultSelectedKey`    | `Key \| null`                                                                      | -           | Default selected key (uncontrolled, single selection)                                                                                                                                                                                    |
| `onSelectionChange`     | `(key: Key \| null) => void`                                                       | -           | Handler called when the selection changes (single selection)                                                                                                                                                                             |
| `value`                 | `Key \| null \| Key[]`                                                             | -           | The currently selected keys (controlled). `Key[]` when `selectionMode="multiple"`                                                                                                                                                        |
| `defaultValue`          | `Key \| null \| Key[]`                                                             | -           | The initial selected keys (uncontrolled). `Key[]` when `selectionMode="multiple"`                                                                                                                                                        |
| `onChange`              | `(value: Key \| null \| Key[]) => void`                                            | -           | Handler called when the selection changes                                                                                                                                                                                                |
| `items`                 | `Iterable<T>`                                                                      | -           | The items to display in the listbox                                                                                                                                                                                                      |
| `disabledKeys`          | `Iterable<Key>`                                                                    | -           | Keys of disabled items                                                                                                                                                                                                                   |
| `defaultFilter`         | `(text: string, inputValue: string) => boolean`                                    | -           | Custom filter function for filtering items                                                                                                                                                                                               |
| `isDisabled`            | `boolean`                                                                          | -           | Whether the ComboBox is disabled                                                                                                                                                                                                         |
| `isReadOnly`            | `boolean`                                                                          | -           | Whether the input can be selected but not changed by the user                                                                                                                                                                            |
| `isRequired`            | `boolean`                                                                          | -           | Whether user input is required                                                                                                                                                                                                           |
| `isInvalid`             | `boolean`                                                                          | -           | Whether the ComboBox value is invalid                                                                                                                                                                                                    |
| `validate`              | `(value: ComboBoxValidationValue) => ValidationError \| true \| null \| undefined` | -           | A function that returns an error message if a given value is invalid. Validation errors are displayed to the user when the form is submitted if `validationBehavior="native"`. For realtime validation, use the `isInvalid` prop instead |
| `validationBehavior`    | `"native" \| "aria"`                                                               | `"native"`  | Whether to use native HTML form validation to prevent form submission when the value is missing or invalid, or mark the field as required or invalid via ARIA                                                                            |
| `name`                  | `string`                                                                           | -           | The name of the input, used when submitting an HTML form                                                                                                                                                                                 |
| `form`                  | `string`                                                                           | -           | The id of a `<form>` element to associate the input with                                                                                                                                                                                 |
| `formValue`             | `"text" \| "key"`                                                                  | `"key"`     | Whether the text or key of the selected item is submitted as part of an HTML form. When `allowsCustomValue` is `true`, this option does not apply and the text is always submitted                                                       |
| `autoComplete`          | `string`                                                                           | -           | Describes the type of autocomplete functionality                                                                                                                                                                                         |
| `autoFocus`             | `boolean`                                                                          | -           | Whether the element should receive focus on render                                                                                                                                                                                       |
| `allowsCustomValue`     | `boolean`                                                                          | -           | Whether the ComboBox allows custom values not in the list                                                                                                                                                                                |
| `allowsEmptyCollection` | `boolean`                                                                          | -           | Whether the ComboBox allows an empty collection                                                                                                                                                                                          |
| `menuTrigger`           | `"focus" \| "input" \| "manual"`                                                   | `"focus"`   | The interaction required to display the ComboBox menu                                                                                                                                                                                    |
| `shouldFocusWrap`       | `boolean`                                                                          | -           | Whether keyboard navigation is circular                                                                                                                                                                                                  |
| `fullWidth`             | `boolean`                                                                          | `false`     | Whether the ComboBox should take full width of its container                                                                                                                                                                             |
| `variant`               | `"primary" \| "secondary"`                                                         | `"primary"` | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces.                                                                       |
| `label`                 | `Content`                                                                          | -           | Rivet shorthand: the Label (with `label` / `placeholder` / `description` / `errorMessage` / `items` the root renders the parts)                                                                                                          |
| `placeholder`           | `string`                                                                           | -           | Rivet shorthand: the input placeholder                                                                                                                                                                                                   |
| `description`           | `Content`                                                                          | -           | Rivet shorthand: the Description under the input group                                                                                                                                                                                   |
| `errorMessage`          | `Content`                                                                          | -           | Rivet shorthand: the FieldError (shown while invalid)                                                                                                                                                                                    |
| `class`                 | `string`                                                                           | -           | Additional CSS classes                                                                                                                                                                                                                   |
| `children`              | `Content \| RenderFunction`                                                        | -           | ComboBox content or render function                                                                                                                                                                                                      |
| `render`                | `DOMRenderFunction<keyof JSX.IntrinsicElements, ComboBoxRenderProps>`              | -           | Overrides the default DOM element with a custom render function.                                                                                                                                                                         |

### ComboBox.Item

Rivet addition: `ListBox.Item` props (`id`, `textValue`, `isDisabled`, …) plus the item indicator; `textValue` defaults to string children.

### ComboBox.InputGroup

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `class`    | `string`  | -       | Additional CSS classes |
| `children` | `Content` | -       | InputGroup content     |

### ComboBox.Value

Renders the selected values of a ComboBox, or a placeholder if no value is selected. By default the selected items are rendered as a comma separated list. Use the render function to customize this (for example, to display tags).

| Prop          | Type                                                       | Default | Description                                    |
| ------------- | ---------------------------------------------------------- | ------- | ---------------------------------------------- |
| `placeholder` | `Content`                                                  | -       | A value to display when no items are selected  |
| `class`       | `string \| (values: ComboBoxValueRenderProps) => string`   | -       | Additional CSS classes                         |
| `children`    | `Content \| (values: ComboBoxValueRenderProps) => Content` | -       | Custom render function for the selected values |

### ComboBox.Trigger

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `class`    | `string`  | -       | Additional CSS classes |
| `children` | `Content` | -       | Custom trigger content |

### ComboBox.Popover

| Prop        | Type                                                                                                                                                                                                                                                                                                                     | Default    | Description                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------ |
| `placement` | `"bottom" \| "bottom left" \| "bottom right" \| "bottom start" \| "bottom end" \| "top" \| "top left" \| "top right" \| "top start" \| "top end" \| "left" \| "left top" \| "left bottom" \| "start" \| "start top" \| "start bottom" \| "right" \| "right top" \| "right bottom" \| "end" \| "end top" \| "end bottom"` | `"bottom"` | Placement of the popover relative to the trigger |
| `class`     | `string`                                                                                                                                                                                                                                                                                                                 | -          | Additional CSS classes                           |
| `children`  | `Content`                                                                                                                                                                                                                                                                                                                | -          | Content children                                 |

### Render Props

When using render functions with ComboBox, these values are provided:

| Prop         | Type            | Description                             |
| ------------ | --------------- | --------------------------------------- |
| `isDisabled` | `() => boolean` | Whether the combobox is disabled.       |
| `isInvalid`  | `() => boolean` | Whether the combobox is invalid.        |
| `isOpen`     | `() => boolean` | Whether the combobox is currently open. |
| `isReadOnly` | `() => boolean` | Whether the combobox is read only.      |
| `isRequired` | `() => boolean` | Whether the combobox is required.       |

::api{symbol="@rivetjs/ui/combo-box#ComboBoxRoot"}

## Accessibility

The ComboBox component implements the ARIA comboBox pattern and provides:

- Full keyboard navigation support
- Screen reader announcements for selection changes and input changes
- Proper focus management
- Support for disabled states
- Typeahead search functionality
- HTML form integration
- Support for custom values

For more information, see the [cdk ComboBox page](site:cdk/components/combobox/).

## Related Components

- [Listbox](/components/list-box/): Scrollable list of selectable items.
- [Popover](/components/popover/): Displays content in context with a trigger.
- [Input](/components/input/): Single-line text input built on React Aria.
- [Label](/components/label/): Accessible label for form controls.
- [FieldError](/components/field-error/): Inline validation messages for form fields.
- [Form](/components/form/): Form validation and submission handling.
- [Surface](/components/surface/): Base container surface.
- [Description](/components/description/): Helper text for form fields.
- [Separator](/components/separator/): Visual divider between content.
- [Avatar](/components/avatar/): Display user profile images.
- [Spinner](/components/spinner/): Loading indicator.
- [Button](/components/button/): Allows a user to perform an action.
