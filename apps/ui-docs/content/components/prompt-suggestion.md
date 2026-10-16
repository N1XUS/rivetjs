---
title: PromptSuggestion
description: "Starter prompts as pills or cards, usually above an empty composer."
template: reference
status: experimental
related: [components/prompt-input, components/card]
---

`PromptSuggestion` offers prompts to start from. The default `pill` variant is a row of rounded buttons; `card` lays items out in a grid with `ItemTitle`, `ItemDescription`, `ItemTags`, `ItemMeta` and `ItemFooter`. An optional `Header` holds a `Title` and `Description`.

Accessibility: items are native buttons in tab order; `Header` text is not a label, so name the group with `aria-label` when there is no visible title.

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

## Cards

::example{id=prompt-suggestion-cards}

## CSS Classes

| Class                                                                            | Applied              |
| -------------------------------------------------------------------------------- | -------------------- |
| `prompt-suggestion`                                                              | root; `data-variant` |
| `prompt-suggestion--pill` / `--card`                                             | variant              |
| `prompt-suggestion__header` / `__title` / `__description`                        | header               |
| `prompt-suggestion__items`                                                       | `Items`              |
| `prompt-suggestion__item`                                                        | `Item`               |
| `prompt-suggestion__item-title` / `-description` / `-meta` / `-tags` / `-footer` | card parts           |

## API Reference

| Prop                  | Type               | Default  |
| --------------------- | ------------------ | -------- |
| `variant`             | `"pill" \| "card"` | `"pill"` |
| `onPress` (`Item`)    | `(e) => void`      | —        |
| `isDisabled` (`Item`) | `boolean`          | `false`  |

`Item` takes the cdk Button props; other parts take `class` and their element's attributes.

::api{symbol="@rivetjs/ui/prompt-suggestion#PromptSuggestionRootProps"}

## Resumability

Static markup; items resume on first press.
