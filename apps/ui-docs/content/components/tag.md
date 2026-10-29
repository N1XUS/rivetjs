---
title: Tag
description: "One selectable or removable token of a TagGroup, with rich content, a disabled state and a custom remove button."
template: reference
status: experimental
related: [components/tag-group, components/chip, components/list-box]
---

`Tag` is one token in a [TagGroup](/components/tag-group/): a category, a filter or a keyword that the user can select, remove, or both. The group decides what tags can do (its `selectionMode` and `onRemove`), and lays them out in `TagGroup.List`; the tag shows its content and state. It is the styled cdk `Tag` (a row of the group's grid). For a label that does nothing, use [Chip](/components/chip/).

## Usage

```tsx
import { Label } from "@rivetjs/ui/label";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

<TagGroup selectionMode="multiple">
  <Label>Topics</Label>
  <TagGroup.List>
    <Tag id="news">News</Tag>
    <Tag id="travel">Travel</Tag>
  </TagGroup.List>
</TagGroup>;
```

::example{id=tag-states}

## Anatomy

| Part | Element | Notes |
| --- | --- | --- |
| `Tag` (`Tag.Root`) | `div role="row"` with a `gridcell` | `data-slot="tag"`, class `tag`; `id` is its key for selection and removal. |
| `Tag.RemoveButton` | `button` (a CloseButton) | `data-slot="tag-remove-button"`, `aria-label="Remove tag"`; only while the group allows removing. |

## Examples

### Content

A tag with only text uses that text for typeahead and its accessible name. With an icon, an avatar or any other content, set `textValue`.

### Size and variant

`size` (`sm`, `md`, `lg`) and `variant` (`default`, `surface`) are props of the `TagGroup`: every tag in the group takes them. A `size` or `variant` on one `Tag` has no effect.

### Disabled

`isDisabled` on a tag (or its key in the group's `disabledKeys`) keeps it visible, removes it from selection and removal, and sets `aria-disabled="true"`.

### Render function

Children can be a function of the tag state: `isSelected()`, `isFocused()`, `isHovered()`, `isPressed()`, `isDisabled()` are accessors; `allowsRemoving` is a boolean. In the example the gluten-free tag swaps its icon when it is selected.

### Removing

When the group has `onRemove`, each tag gets a remove button, and :kbd[Delete] or :kbd[Backspace] on a focused tag removes it. `onRemove` receives the set of keys; remove them from your data (the example uses `createListData` from `@rivetjs/cdk/data`).

### Custom remove button

Write a `Tag.RemoveButton` inside the tag to replace the default one (for example, with a different icon). It renders where you place it, and nothing while the group does not allow removing. See [TagGroup: With Remove Button](/components/tag-group/#with-remove-button).

## Styling Reference

| Class / attribute | Part |
| --- | --- |
| `.tag`, `.tag--sm` / `--md` / `--lg`, `.tag--default` / `--surface` | Tag, with the group's size and variant. |
| `.tag__remove-button` | Remove button (`data-slot="tag-remove-button"`). |
| `[data-selected]`, `[data-disabled]`, `[data-allows-removing]`, `[data-focused]`, `[data-focus-visible]`, `[data-hovered]`, `[data-pressed]` | Tag state. |

## API Reference

See the [full module API](/api/rivetjs/ui/tag/) for every named export and part prop type.

| Prop      | Values               | Default   |
| --------- | -------------------- | --------- |
| `size`    | `lg`, `md`, `sm`     | `md`      |
| `variant` | `default`, `surface` | `default` |

The table lists the variants a tag is styled with; set them on the [TagGroup](/components/tag-group/).

::api{symbol="@rivetjs/ui/tag#TagRemoveButtonProps"}

::api{symbol="@rivetjs/ui/tag#TagRootProps"}

## Accessibility

- The group is a `grid` and each tag a `row`; :kbd[ArrowLeft] / :kbd[ArrowRight] (and Up / Down) move between tags, :kbd[Home] / :kbd[End] go to the ends, :kbd[Space] / :kbd[Enter] select, :kbd[Delete] / :kbd[Backspace] remove.
- Name the group with its `Label`. Keep a meaningful `aria-label` on a custom remove button that shows only an icon.
- A selected tag is announced from `aria-selected`; do not rely on color alone to show it (the example adds an icon).

## Common mistakes

- **Setting `size` or `variant` on a Tag.** They are read from the group.
- **Removing without updating the data.** `onRemove` only reports the keys; the tag stays until your list no longer contains it.
- **Tags without `id` in a dynamic list.** Selection and removal use keys; give every tag a stable `id`.

## Related Components

- [TagGroup](/components/tag-group/)
- [Chip](/components/chip/)
- [ListBox](/components/list-box/)
