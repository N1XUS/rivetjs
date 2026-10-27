---
title: Radio
description: "A single labelled choice within a mutually exclusive RadioGroup."
template: reference
status: experimental
related: [components/radio-group, components/radio-button-group, components/checkbox]
---

`Radio` — A single labelled choice within a mutually exclusive RadioGroup.

## Usage

```tsx
import { Radio } from "@rivetjs/ui/radio";
```

::example{id=radio-group-basic}

## Anatomy

Place Radio inside RadioGroup. Content contains Control and Indicator plus the option label; `label` and `description` are shorthand props on Radio. Set `value` to identify the option.

Public parts: `Radio.Root`, `Radio.Content`, `Radio.Control`, `Radio.Indicator`.

## Styling Reference

The component emits these `data-slot` values across its parts: `radio`, `radio-content`, `radio-control`, `radio-indicator`.

Base and part classes: `radio`, `radio__content`, `radio__control`, `radio__indicator`.

## API Reference

See the [full module API](/api/rivetjs/ui/radio/) for every named export and part prop type.

::api{symbol="@rivetjs/ui/radio#RadioContentProps"}

::api{symbol="@rivetjs/ui/radio#RadioControlProps"}

::api{symbol="@rivetjs/ui/radio#RadioIndicatorProps"}

::api{symbol="@rivetjs/ui/radio#RadioRootProps"}

## Accessibility

The parent RadioGroup supplies the group label and selected value. Radio uses the cdk radio field and button parts, including native radio input behavior; arrow keys navigate choices and Space selects. Indicator is decorative. Label every choice and the group.

## Related Components

- [RadioGroup](/components/radio-group/)
- [RadioButtonGroup](/components/radio-button-group/)
- [Checkbox](/components/checkbox/)
