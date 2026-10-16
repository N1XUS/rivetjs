---
title: TagGroup
description: "A focusable list of tags with support for keyboard navigation, selection, and removal."
template: reference
status: experimental
related: [components/label, components/description, components/error-message, components/close-button]
---

`TagGroup` is a focusable list of tags, with optional selection and removal. It is the [cdk TagGroup](site:cdk/components/tag-group/): `TagGroup.List` (cdk `TagList`, a `grid`) holds the `Tag`s (`@rivetjs/ui/tag`, cdk `Tag` rows); a [Label](label.md), [Description](description.md) and [ErrorMessage](error-message.md) can sit beside the list.

Notes:

- `class`, not `className`. `selectedKeys` takes a signal (two-way); render props are accessors except `allowsRemoving` (a boolean).
- A `Tag` with mixed content (icon + text) needs `textValue` (children are compiled slots, not inspectable). Demos with mixed content pass it.
- A custom `Tag.RemoveButton` replaces the default one but renders where it is written.
- List state: the cdk `createListData` (`@rivetjs/cdk/data`).

Accessibility: a `grid` of `row`s with arrow-key navigation; Delete / Backspace remove the focused tag when `onRemove` is set; the remove button is labelled "Remove tag …".

## Usage

```tsx
import { TagGroup } from "@rivetjs/ui/tag-group";
```

::example{id=tag-group-basic}

## Anatomy

```tsx
import { Description } from "@rivetjs/ui/description";
import { ErrorMessage } from "@rivetjs/ui/error-message";
import { Label } from "@rivetjs/ui/label";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export default () => (
  <TagGroup>
    <Label />
    <TagGroup.List>
      <Tag>
        <Tag.RemoveButton />
      </Tag>
    </TagGroup.List>
    <Description />
    <ErrorMessage />
  </TagGroup>
)
```

## Examples

### Shorthand

Rivet addition: with `label`, `description`, `errorMessage` or `items`, the root renders the Label, the `TagGroup.List` around its children (the `Tag`s, or a render function of one item with `items`), the Description and the ErrorMessage, with the compound form's markup. Use the parts to put other content between them. Children do not switch the shorthand off: in the shorthand form they are the list content.

`items` selects the shorthand form: compound parts next to `items` win and `items` is ignored, with a development warning. `items` is live (appended / removed tags update the list). The form is decided once, at render: adding or removing `label` / `description` / `errorMessage` / `items` later does not switch it.

::example{id=tag-group-shorthand}

### Sizes

::example{id=tag-group-sizes}

### Variants

::example{id=tag-group-variants}

### Disabled

::example{id=tag-group-disabled}

### Selection Modes

::example{id=tag-group-selection-modes}

### Controlled

::example{id=tag-group-controlled}

### With Error Message

::example{id=tag-group-with-error-message}

### With List Data

::example{id=tag-group-with-list-data}

### With Prefix

::example{id=tag-group-with-prefix}

### With Remove Button

::example{id=tag-group-with-remove-button}

### Render Function

::example{id=tag-group-render-function}

## Customization

### Tailwind CSS

::example{id=tag-group-custom-styles}

### Global CSS

To customize the TagGroup component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .tag-group {
    @apply flex flex-col gap-2;
  }

  .tag-group__list {
    @apply flex flex-wrap gap-2;
  }

  .tag {
    @apply rounded-full px-3 py-1;
  }

  .tag__remove-button {
    @apply ml-1;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The TagGroup component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/tag-group.css) and [tag.css](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/tag.css)):

#### Base Classes
- `.tag-group` - Base tag group container
- `.tag-group__list` - Container for the list of tags
- `.tag` - Base tag styles
- `.tag__remove-button` - Remove button trigger

#### Slot Classes
- `.tag-group [slot="description"]` - Description slot styles
- `.tag-group [slot="errorMessage"]` - ErrorMessage slot styles

#### Size Classes
- `.tag--sm` - Small size tag
- `.tag--md` - Medium size tag (default)
- `.tag--lg` - Large size tag

#### Variant Classes
- `.tag--default` - Default variant
- `.tag--surface` - Surface variant with surface background

#### State Classes
- `.tag[data-selected="true"]` - Selected tag state
- `.tag[data-disabled="true"]` - Disabled tag state
- `.tag[data-hovered="true"]` - Hovered tag state
- `.tag[data-pressed="true"]` - Pressed tag state
- `.tag[data-focus-visible="true"]` - Focused tag state (keyboard focus)

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]` on tag
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on tag
- **Pressed**: `:active` or `[data-pressed="true"]` on tag
- **Selected**: `[data-selected="true"]` or `[aria-selected="true"]` on tag
- **Disabled**: `:disabled` or `[data-disabled="true"]` on tag

## API Reference

### TagGroup

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `selectionMode` | `"none" \| "single" \| "multiple"` | `"none"` | The type of selection that is allowed |
| `selectedKeys` | `Selection` | - | The currently selected keys (controlled) |
| `defaultSelectedKeys` | `Selection` | - | The initial selected keys (uncontrolled) |
| `onSelectionChange` | `(keys: Selection) => void` | - | Handler called when the selection changes |
| `disabledKeys` | `Iterable<Key>` | - | Keys of disabled tags |
| `isDisabled` | `boolean` | - | Whether the tag group is disabled |
| `onRemove` | `(keys: Set<Key>) => void` | - | Handler called when tags are removed |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Size of the tags in the group |
| `variant` | `"default" \| "surface"` | `"default"` | Visual variant of the tags |
| `label` | `Content` | - | Rivet shorthand: the Label before the list (the root then renders the List) |
| `description` | `Content` | - | Rivet shorthand: the Description after the list |
| `errorMessage` | `Content` | - | Rivet shorthand: the ErrorMessage after the Description |
| `items` | `Iterable<T>` | - | Rivet shorthand: the list items; `children` is then a render function of one item |
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content \| RenderFunction` | - | TagGroup content or render function |
| `render` | `DOMRenderFunction<keyof JSX.IntrinsicElements, undefined>` | - | Overrides the default DOM element with a custom render function.|

### TagGroup.List

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `Iterable<T>` | - | The items to display in the tag list |
| `renderEmptyState` | `() => Content` | - | Function to render when the list is empty |
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content \| RenderFunction` | - | TagList content or render function |
| `render` | `DOMRenderFunction<keyof JSX.IntrinsicElements, TagListRenderProps>` | - | Overrides the default DOM element with a custom render function.|

### Tag

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `Key` | - | The unique identifier for the tag |
| `textValue` | `string` | - | A string representation of the tag's content, used for accessibility |
| `isDisabled` | `boolean` | - | Whether the tag is disabled |
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content \| RenderFunction` | - | Tag content or render function |
| `render` | `DOMRenderFunction<keyof JSX.IntrinsicElements, TagRenderProps>` | - | Overrides the default DOM element with a custom render function.|

**Note**: `size`, `variant` are inherited from the parent `TagGroup` component and cannot be set directly on individual `Tag` components.

### Tag.RemoveButton

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content` | - | Custom remove button content (defaults to close icon) |

**Note**: The `Tag.RemoveButton` component supports customization similar to `SearchField.ClearButton`. When `onRemove` is provided to `TagGroup`:

- **Auto-rendering**: If no custom `Tag.RemoveButton` is included in the `Tag` children, a default remove button is automatically rendered.
- **Custom button**: If a custom `Tag.RemoveButton` is provided as a child of `Tag`, it will be used instead of the auto-rendered button.
- **Custom icon**: You can pass custom content (like icons) to `Tag.RemoveButton` children to customize the appearance.

**Example - Auto-rendered (default)**:
```tsx
<TagGroup onRemove={handleRemove}>
  <TagGroup.List>
    <Tag id="news">News</Tag>
    {/* Remove button is automatically rendered */}
  </TagGroup.List>
</TagGroup>
```

**Example - Custom RemoveButton with icon**:
```tsx
<TagGroup onRemove={handleRemove}>
  <TagGroup.List>
    <Tag id="news">
      News
      <Tag.RemoveButton>
        <CustomIcon />
      </Tag.RemoveButton>
    </Tag>
  </TagGroup.List>
</TagGroup>
```

**Example - Custom RemoveButton in render props**:
```tsx
<Tag id="news">
  {(renderProps) => (
    <>
      News
      {!!renderProps.allowsRemoving && (
        <Tag.RemoveButton>
          <CustomIcon />
        </Tag.RemoveButton>
      )}
    </>
  )}
</Tag>
```

### Render Props

When using render functions with TagGroup.List, these values are provided:

| Prop | Type | Description |
|------|------|-------------|
| `isSelected` | `() => boolean` | Whether the tag is selected |
| `isDisabled` | `() => boolean` | Whether the tag is disabled |
| `isHovered` | `() => boolean` | Whether the tag is hovered |
| `isPressed` | `() => boolean` | Whether the tag is pressed |
| `isFocused` | `() => boolean` | Whether the tag is focused |
| `isFocusVisible` | `() => boolean` | Whether the tag has keyboard focus |

::api{symbol="@rivetjs/ui/tag-group#TagGroupRootProps"}

## Related Components

- [Label](/components/label/): Accessible label for form controls.
- [Description](/components/description/): Helper text for form fields.
- [ErrorMessage](/components/error-message/): Displays validation error messages for components with validation support.
- [CloseButton](/components/close-button/): Button for dismissing overlays.
