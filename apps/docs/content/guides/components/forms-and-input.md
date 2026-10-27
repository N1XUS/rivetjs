---
title: Forms and input
description: Bind text fields and checkboxes to signals with model:value and model:checked, and handle selects, radios and number fields.
template: guide
related: [guides/forms/forms, guides/routing/actions-and-forms, guides/components/events]
---

Inputs are where users give your page data. After reading this page you can keep inputs and signals in sync, handle the input types that have no shortcut, and decide when you need a real form library.

::example{id=two-way-input}

## Two-way binding: model:value

`model:value` connects a text field to a signal in both directions. Typing writes the signal. Setting the signal changes the field.

```tsx
import { signal } from "@rivetjs/reactivity";

export default function Greeting() {
  const name = signal("");
  return (
    <div>
      <input model:value={name} placeholder="Your name" />
      <p>Hello, {name() || "friend"}.</p>
      <button type="button" onClick={() => name.set("")}>
        Clear
      </button>
    </div>
  );
}
```

The server renders the current value into the field. In the browser, the first time you type, Rivet copies the field into the signal. No code from your app has to load for that.

`model:value` works on:

- `<textarea>`,
- `<input>` with no `type` or with `type` set to `text`, `search`, `email`, `url`, `tel` or `password`.

- `<select>`: the signal holds the selected option's value; with `multiple`, a `string[]` of values.

It also handles typing with an input method editor (for example Japanese or Chinese input) correctly.

## Checkboxes: model:checked

`model:checked` connects a checkbox to a `boolean` signal:

```tsx
import { signal } from "@rivetjs/reactivity";

const subscribed = signal(false);

<label>
  <input type="checkbox" model:checked={subscribed} />
  Send me the newsletter
</label>
<p>{subscribed() ? "You will get emails." : "No emails."}</p>;
```

## Rules for model

- Pass the signal itself: `model:value={name}`, not `model:value={name()}`. A property path like `model:value={form.email}` also works.
- The signal must be writable (made with `signal`, not `computed`).
- The `type` attribute must be written as a fixed string. `type={kind()}` is not allowed.
- A `<textarea>` with `model:value` cannot also have children.

Anything else stops the compiler with `Unsupported model binding: model:value`.

## Inputs without model

For other input types, read the value in a handler and write a `value`, `checked` or `selected` attribute. Read the element from `event.target` (see [events](./events.md#read-the-element)).

`onChange` is the browser's own `change` event, not React's: on a text field it fires when the field loses focus after an edit, not on every key. Use `onInput` (or `model:value`) to react while the user types.

### Number and range

```tsx
import { signal } from "@rivetjs/reactivity";

const amount = signal(1);

<input type="number" min={1} max={10} value={amount()} onInput={(event) => amount.set((event.target as HTMLInputElement).valueAsNumber || 1)} />;
```

### Select

```tsx
import { signal } from "@rivetjs/reactivity";

const size = signal("m");

<select name="size" model:value={size}>
  <option value="s">Small</option>
  <option value="m">Medium</option>
  <option value="l">Large</option>
</select>;
```

- The server writes `selected` on the matching option; options from `.map(...)` inside the select count too.
- `value={size()}` instead of `model:value` sets the selection one way (no write back).
- `multiple` + `signal<string[]>([])`: every listed value is selected.
- Options from another component are not compared: give that component the value and let it write `selected`.

### Radio buttons

```tsx
import { signal } from "@rivetjs/reactivity";

const color = signal("teal");

{["teal", "amber"].map((value) => (
  <label>
    <input type="radio" name="color" value={value} checked={color() === value} onChange={() => color.set(value)} />
    {value}
  </label>
))}
```

## Submit a form

Handle `onSubmit` on the `<form>`. Keep `action` and `method`, so the form still works before JavaScript runs or when it fails:

```tsx
<form
  method="post"
  action="?/subscribe"
  onSubmit={(event) => {
    if (!email().includes("@")) {
      event.preventDefault();
      error.set("Please enter an email address.");
    }
  }}
>
  <input type="email" name="email" model:value={email} autoComplete="email" />
  <p role="alert">{error()}</p>
  <button>Subscribe</button>
</form>
```

If the handler does not call `preventDefault()`, the browser submits the form as usual, and a route [action](/guides/routing/actions-and-forms.md) on the server handles it.

## Validated forms

For real forms with a schema, field errors, accessible messages and server checks, use `@rivetjs/forms`. It builds on the same ideas and works without JavaScript too. See [forms](/guides/forms/forms.md).

## Common mistakes

- **`value={name()}` without a handler.** The field shows the value, but typing does not change the signal. Use `model:value`.
- **`model:value` on a number field.** Not supported. Use `onInput` with `valueAsNumber`.
- **Losing the server submission target.** A form without `action` submits to the current URL. Keep the intended `action` and `method` so the server can handle it when JavaScript is unavailable. See [links and forms without JS](/best-practices/links-and-forms-without-js.md).
- **camelCase attributes.** Use the names from the JSX types: `autoComplete`, `autoFocus`, `maxLength`, `readOnly`.

## See also

- [Events](./events.md)
- [Forms](/guides/forms/forms.md)
- [Actions and forms](/guides/routing/actions-and-forms.md)
