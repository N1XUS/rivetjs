---
title: Links and forms that work without JavaScript
description: Navigate with real links and change data with real forms, then add JavaScript on top, so pages work before code loads and when it fails.
template: best-practice
related: [guides/routing/links-and-navigation, guides/routing/actions-and-forms, guides/forms/forms, recipes/optimistic-like]
---

**Use `<a href>` to go somewhere and `<form method="post">` to change something. Add handlers on top of them, never instead of them.**

## Why

A Rivet page is server-rendered HTML. Its JavaScript loads later, on demand. Links and forms that are real HTML work at every moment:

- **Before code loads.** Until the router has started, a link click is a normal page load. If the link or form has a handler whose code is not loaded yet, Rivet holds the event, loads the code, runs the handler, and then continues with the normal link or submit, unless the handler called `preventDefault()`.
- **Without JavaScript.** When scripts are off or blocked, the browser follows the link or posts the form itself.
- **For everyone.** Screen readers announce links and buttons correctly. Middle-click, "open in new tab", copying the link address and search engines all need a real `href`.

With the router running, Rivet makes links faster: it handles same-site link clicks inside the page and fetches only the next page's data. You get that speed without giving up the HTML behaviour.

## Do

```tsx prefer
import { Link } from "@rivetjs/router/link";

// A link: plain <a href>. <Link> adds typed paths and router options, and still renders <a href>.
<Link to="/orders">Your orders</Link>

// A change: a form posting to a server action (`serverActions.cancel` in src/routes/orders.tsx).
<form method="post" action="?/cancel">
  <input type="hidden" name="id" value={order.id} />
  <button>Cancel order</button>
</form>
```

To make the form feel instant, add an `onSubmit` handler that calls `event.preventDefault()` and sends the request with `fetch`. Without JavaScript, the form still posts. The [optimistic like](/recipes/optimistic-like.md) recipe shows the full pattern, and [`@rivetjs/forms`](/guides/forms/forms.md) does it for you, with validation.

## Don't

```tsx avoid
// No href: no new tab, no link preview, nothing works until the code loads.
<span class="link" onClick={() => router.navigate("/orders")}>Your orders</span>

// No form: without the handler's code, the button does nothing.
<button type="button" onClick={() => fetch("/api/cancel", { method: "POST", body: id })}>Cancel order</button>
```

## When to break it

- **Pure browser features.** A button that opens a menu, copies text or switches the theme has no server equivalent. Use `type="button"` and a handler.
- **Live typing.** Filtering while typing is a handler (with a `<form method="get">` around it if the server can also filter).
- **Full page loads on purpose.** A link whose path matches none of your page routes, such as a link into a different app on the same site, already loads the whole page. Add `data-rivet-reload` to a link (or `reload` on `<Link>`) to load one of your own pages in full.
