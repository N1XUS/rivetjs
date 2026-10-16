---
title: Coercion
description: Turn loosely typed option values into the types widget code needs with @rivetjs/cdk/coercion - booleans, numbers, CSS pixels, arrays, elements, accessors.
template: guide
status: experimental
related: [foundations/utilities, foundations/observers]
---

Options often arrive as strings (attributes, URL parameters, CMS data) or as either a value or an accessor. `@rivetjs/cdk/coercion` ports the Angular CDK coercion helpers and adds Rivet's accessor and ref forms. Every function is pure and server-safe.

::example{id=coercion-values}

## Import

```ts
import { coerceBooleanProperty, coerceNumberProperty, coerceCssPixelValue, coerceArray, coerceStringArray, coerceElement, coerceAccessor } from "@rivetjs/cdk/coercion";
```

## API

| Export | Signature | Result |
| --- | --- | --- |
| `coerceBooleanProperty` | `(value: unknown) => boolean` | `true` for everything except `null`, `undefined`, `false` and `"false"`. The empty string (a present attribute) is `true`. |
| `coerceNumberProperty` | `(value: unknown, fallback?) => number \| fallback` | `Number(value)` when both `parseFloat` and `Number` accept it, else `fallback` (default `0`). `"12px"` is not a number. |
| `_isNumberValue` | `(value: unknown) => boolean` | The check above. |
| `coerceCssPixelValue` | `(value: unknown) => string` | Numbers get `px`, strings pass unchanged, `null` / `undefined` give `""`. |
| `coerceArray` | `<T>(value: T \| T[]) => T[]` | The array itself, or `[value]`. |
| `coerceStringArray` | `(value: unknown, separator = /\s+/) => string[]` | Trimmed, non-empty strings: arrays item by item, other values stringified and split. `null` / `undefined` give `[]`. |
| `coerceElement` | `<T>(elementOrRef: T \| (() => T \| null \| undefined)) => T` | The element, or the result of a ref accessor (Angular `ElementRef` maps to Rivet's ref accessor). |
| `coerceAccessor` | `<T>(data: T \| (() => T)) => () => T` | Accessors (signals, computeds, functions) pass through; plain values become constant accessors. Angular `coerceObservable` equivalent. |

Types: `BooleanInput` (`string | boolean | null | undefined`), `NumberInput` (`string | number | null | undefined`), `ElementInput<T>` (`T | (() => T | undefined | null)`).

## Use in a component

```tsx title="src/components/Spinner.tsx"
import { coerceBooleanProperty, coerceCssPixelValue, coerceNumberProperty, type BooleanInput, type NumberInput } from "@rivetjs/cdk/coercion";

export function Spinner(props: { size?: NumberInput; hidden?: BooleanInput }) {
  const size = coerceCssPixelValue(coerceNumberProperty(props.size, 24));
  return <span class="spinner" hidden={coerceBooleanProperty(props.hidden) || undefined} style={{ width: size, height: size }} />;
}
```

## Resumability

Coercion runs while the component renders, on the server and in client-rendered trees. The results are plain values, so nothing needs to resume. `coerceAccessor` returns a new arrow for a plain value: read it in render, do not store it in state that has to serialize.

## Upstream

Angular CDK `cdk/coercion`: `coerceBooleanProperty`, `coerceNumberProperty`, `_isNumberValue`, `coerceArray`, `coerceCssPixelValue`, `coerceStringArray`, `coerceElement` (for Rivet ref accessors), `BooleanInput`, `NumberInput`. `coerceAccessor` stands in for `coerceObservable`.

## Common mistakes

- **`coerceBooleanProperty("")` is `true`.** A present attribute without value means on, as in HTML.
- **Expecting `coerceNumberProperty("12px")` to be 12.** It is `0` (or your fallback). Strip units first.
- **Splitting comma lists with the default separator.** Pass `","` for comma-separated values.
