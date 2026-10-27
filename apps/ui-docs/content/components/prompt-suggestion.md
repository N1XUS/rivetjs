---
title: PromptSuggestion
description: "Starter prompts as pills or cards, usually above an empty composer."
template: reference
status: experimental
related: [components/prompt-input, components/card]
---

`PromptSuggestion` offers prompts to start from. The default `pill` variant is a row of rounded buttons; `card` lays items out in a grid with `ItemTitle`, `ItemDescription`, `ItemTags`, `ItemMeta` and `ItemFooter`. An optional `Header` holds a `Title` and `Description`.

## Usage

```tsx
import { PromptSuggestion } from "@rivetjs/ui/prompt-suggestion";
```

::example{id=prompt-suggestion-basic}

## Anatomy

```tsx
<PromptSuggestion variant="card">
  <PromptSuggestion.Header>
    <PromptSuggestion.Title>Try</PromptSuggestion.Title>
  </PromptSuggestion.Header>
  <PromptSuggestion.Items>
    <PromptSuggestion.Item onPress={() => use("…")}>
      <PromptSuggestion.ItemTitle>Plan a sprint</PromptSuggestion.ItemTitle>
    </PromptSuggestion.Item>
  </PromptSuggestion.Items>
</PromptSuggestion>
```

Additional exported parts: `PromptSuggestion.Root`, `PromptSuggestion.Description`, `PromptSuggestion.ItemDescription`, `PromptSuggestion.ItemMeta`, `PromptSuggestion.ItemTags`, `PromptSuggestion.ItemFooter`.

## Examples

### Cards

::example{id=prompt-suggestion-cards}

### Resumability

Static markup; items resume on first press.

## Styling Reference

The component’s parts emit these additional `data-slot` values: `prompt-suggestion-item`.

### CSS Classes

| Class                                                                            | Applied              |
| -------------------------------------------------------------------------------- | -------------------- |
| `prompt-suggestion`                                                              | root; `data-variant` |
| `prompt-suggestion--pill` / `--card`                                             | variant              |
| `prompt-suggestion__header` / `__title` / `__description`                        | header               |
| `prompt-suggestion__items`                                                       | `Items`              |
| `prompt-suggestion__item`                                                        | `Item`               |
| `prompt-suggestion__item-title` / `-description` / `-meta` / `-tags` / `-footer` | card parts           |

## API Reference

See the [full module API](/api/rivetjs/ui/prompt-suggestion/) for every named export and part prop type.

| Prop                  | Type               | Default  |
| --------------------- | ------------------ | -------- |
| `variant`             | `"pill" \| "card"` | `"pill"` |
| `onPress` (`Item`)    | `(e) => void`      | —        |
| `isDisabled` (`Item`) | `boolean`          | `false`  |

`Item` takes the cdk Button props; other parts take `class` and their element's attributes.

::api{symbol="@rivetjs/ui/prompt-suggestion#PromptSuggestionRootProps"}

## Accessibility

items are native buttons in tab order; `Header` text is not a label, so name the group with `aria-label` when there is no visible title.

## Related Components

- [PromptInput](/components/prompt-input/)
- [Card](/components/card/)
