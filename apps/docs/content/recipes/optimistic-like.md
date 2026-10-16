---
title: Optimistic like
description: Update a like button at once, save the change in the background and undo it with a message when the server fails.
template: recipe
related: [guides/components/events, guides/routing/actions-and-forms, best-practices/links-and-forms-without-js, best-practices/error-handling]
---

## What you will build

A like button. When you click it, the count changes at once. The server is told in the background. If the server fails, the button goes back to how it was and a message explains why.

This is called an **optimistic update**: you show the expected result before the server confirms it, because it usually succeeds.

The example needs a server (it has a form action), so it is shown as code. Copy it into the server starter and tick "Make the server fail" to see the undo.

::example{id=optimistic-like}

## How it works

### 1. Start with a form that works without JavaScript

```tsx
<form method="post" action="?/like">
  <input type="hidden" name="liked" value={liked() ? "false" : "true"} />
  <button>…</button>
</form>
```

Without JavaScript, a click posts the form to the `like` action. The action saves the change and answers with `redirect("/", 303)`. The browser loads the page again with the new count.

The form sends `liked=true` or `liked=false`: the state the user wants, not "toggle". If the same request arrives twice, the result is the same.

### 2. Take over the submit in the browser

The `save` function is the form's `onSubmit` handler. It calls `event.preventDefault()` first. Then the browser does not post the form, and the handler is in charge.

Rivet runs the handler right away, also on the very first click, when its code may still be loading. The click waits for the code; `preventDefault()` still works.

### 3. Update first, then ask the server

```tsx
const before = { liked: liked(), likes: likes() };
const next = !before.liked;
liked.set(next);
likes.set(before.likes + (next ? 1 : -1));
```

The button and the count change now. Then the handler sends the request:

```tsx
const response = await fetch("?/like", { method: "POST", headers: { accept: "application/json" }, body });
if (!response.ok) throw new Error("HTTP " + response.status);
```

`accept: application/json` tells the action that a script is asking. The action returns data instead of a redirect, and Rivet answers with JSON.

### 4. Undo on failure

The `catch` block puts the saved `before` values back and sets a message. The message is in an element with `role="alert"`, so screen readers announce it.

`fetch` only rejects on network errors. A 500 or 503 answer still resolves, so check `response.ok` yourself.

### 5. One request at a time

A `pending` signal blocks a second submit while the first one runs. Without it, two fast clicks could reach the server in the wrong order.

### On the server

```tsx title="src/routes/index.tsx"
like: async ({ request }: RequestEvent) => {
  const form = await request.formData();
  const liked = form.get("liked") === "true";
  // …save…
  if (request.headers.get("accept")?.includes("application/json")) return { likes: post.likes, liked };
  return redirect("/", 303);
},
```

Actions check that the request comes from your own site (the `Origin` header). A `fetch` from your page passes that check.

## Variations

- **Use the server's count.** The response body holds the action result. If other people like the post at the same time, you can show the server's number after the request.
- **Retry.** Instead of a message, offer a "Try again" button that sends the same request.
- **Many items.** In a list, keep `liked` and `likes` per row. Each row's handler captures only its own signals.

## Watch out

- **Only for likely successes.** Optimistic updates suit small, reversible actions: likes, stars, toggles. For payments or anything you cannot undo, wait for the server.
- **Keep the old values.** Save them before you change the signals, not after the request.
- **The demo state is shared.** The example keeps the count in a variable on the server, so every visitor sees the same post. A real app stores it per user in a database.
