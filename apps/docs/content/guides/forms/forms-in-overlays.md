---
title: Forms in drawers and dialogs
description: Submit a form inside a drawer or dialog without a page reload. The drawer stays open on errors, the list behind it updates, and it works without JavaScript.
template: guide
status: experimental
since: 0.1.0
related: [guides/forms/forms, guides/routing/actions-and-forms, guides/routing/loading-data]
---

A form often lives in an overlay: "New customer" in a drawer, "Edit address" in a dialog. When the user saves, two things must happen. The data behind the overlay must update, and the overlay must keep its state: stay open with the problems shown, or close once the save worked. After reading this page you can build such a form, with and without JavaScript.

::example{id=drawer-form}

## Make the page live

By default, a successful submit reloads the page's data and renders the page again. That also resets everything the page holds in signals, such as an open drawer. Mark the page live instead:

```tsx title="src/routes/index.tsx"
import { For } from "@rivetjs/runtime/dom";

import type { LivePageProps } from "@rivetjs/router";
import { load } from "@rivetjs/router";

export const live = true;

export const loader = load(() => ({ customers: listCustomers() }));

export default function Customers({ data }: LivePageProps<typeof loader>) {
  return <For each={data().customers} by={(customer) => customer.id}>{(customer) => <li>{customer().name}</li>}</For>;
}
```

On a live page, `data` is a function, like a layout's `data`. When the page's data is loaded again for the same address, the router updates `data` in place. It does not render the page again:

- a form submit from `@rivetjs/forms`, `invalidate()` and `invalidate(key)` all update `data` and the layouts' data;
- only the parts that read `data()` change. `<For>` with `by` keeps the existing rows and adds the new one;
- signals, typed input, focus and scroll position stay as they were.

Following a link to the same page with other search parameters (`?new`, `setSearchParams`, the back and forward buttons between them) also keeps the page: the router loads the data for the new address and updates `data` in place. Navigating to another page renders that page as usual. In an app with nested layouts that have their own loaders, a search change still renders the page again.

## Put the form in the drawer

The drawer is an ordinary overlay with an `isOpen` signal. Close it when the submit worked: `onSubmit` resolves to `true` once the server accepted the form and the new data is on the page.

```tsx
import { signal } from "@rivetjs/reactivity";
import { createForm, formId, onSubmit } from "@rivetjs/forms";

const open = signal(false);
const form = createForm(customerForm, { result: actionResult("customer") });

<Modal isDismissable isOpen={open}>
  <Dialog>
    <form
      id={formId(form)}
      method="post"
      action="?/customer"
      onSubmit={async (event) => (await onSubmit(customerForm, form, event)) && open.set(false)}
    >
      …
    </form>
  </Dialog>
</Modal>;
```

When the server finds a problem (here: the email is already taken), `onSubmit` resolves to `false`. The drawer stays open, the message shows next to the field, and focus moves to it. The page behind the drawer does not change.

One request does all of it. The browser posts the form, and the answer carries both the action's result and the page's fresh data. There is no second request for the data.

## Without JavaScript

The same page works as plain HTML:

- give the button that opens the drawer a real link, such as `href="?new"`, and open the drawer on the server when the address has `?new`;
- after a failed post, the server renders the page again with status `400`. Open the drawer when the action failed, so the messages show inside it;
- after a successful post, the page renders with the new data and the drawer closed.

```tsx
import { type RequestEvent } from "@rivetjs/router";
import { signal } from "@rivetjs/reactivity";

import { load } from "@rivetjs/router";
export const loader = load(({ url }: RequestEvent) => ({ customers: listCustomers(), creating: url.searchParams.has("new") }));

// In the component:
const result = actionResult("customer");
const open = signal(data().creating || (result?.status ?? 0) >= 400);
```

With JavaScript, the link's click handler calls `event.preventDefault()` and opens the drawer in place. Add `data-rivet-prefetch="none"` to the link, so hovering it does not load the `?new` data for nothing. If you let the link navigate instead, the page stays and `data().creating` becomes `true`: read it where you need it, for example in the drawer's `isOpen`.

## When the action redirects

An action may answer with a redirect to the page the form is on (post, redirect, get). On a live page this also updates `data` in place, and the redirect answer already carries the fresh data, so no second request is made. A redirect to another page navigates there, and `onSubmit` resolves once that page is shown.

## Common mistakes

- **Reading `data` as a value.** On a live page it is a function: write `data().customers`, not `data.customers`. `LivePageProps` makes TypeScript catch it.
- **Copying the data into a signal.** `signal(data().customers)` takes a copy once, which then never updates. Read `data()` where you render.
- **Rendering the list with `.map()`.** It works, but every update rebuilds all rows. `<For each by>` keeps them.

## See also

- [Forms](./forms.md): describe, check and render a form
- [Actions and forms](../routing/actions-and-forms.md): what the router does with a post
- [Reload data after a change](../routing/loading-data.md#reload-data-after-a-change): `invalidate`
- [Design spec](https://github.com/N1XUS/rivetjs/blob/main/docs/design/specs/2026-10-08-partial-render-design.md)
