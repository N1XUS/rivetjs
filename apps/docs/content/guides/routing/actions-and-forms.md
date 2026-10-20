---
title: Actions and forms
description: Handle form submits on the server with actions, redirect after a change, show errors with fail() and actionResult(), and keep forms working without JavaScript.
template: guide
related: [guides/forms/forms, guides/routing/guards, guides/components/forms-and-input, best-practices/links-and-forms-without-js]
---

An **action** is a server function that handles a form submit. You write a normal HTML `<form method="post">`, and the action reads the fields, changes data and sends the visitor on. The form works before any JavaScript loads, and with JavaScript turned off. After reading this page you can write actions, redirect after them, and show errors.

::example{id=action-form}

## Write an action

Export `actions(…)` from the page file. Each key is an action name. The form posts to the page's own URL with `?/` and the action name:

```tsx title="src/routes/index.tsx"
import { redirect, type RequestEvent, actions } from "@rivetjs/router";
import { db } from "../db.server.ts"; // used only by the actions: removed from the browser build

export const forms = actions({
  add: async ({ request }: RequestEvent) => {
    const form = await request.formData();
    const text = String(form.get("text") ?? "").trim();
    if (text) await db.notes.add(text.slice(0, 200));
    return redirect("/");
  },
});

export default function Notes() {
  return (
    <form method="post" action="?/add">
      <label for="text">New note</label>
      <input id="text" name="text" required />
      <button>Add</button>
    </form>
  );
}
```

`actions(…)` runs only on the server; the compiler removes it from the browser build. See [server code in route files](./server-code-in-routes.md).

A page can have several actions, for example `?/add` and `?/delete`, each in its own form. A button can pick a different action with `formaction="?/delete"`.

The submit is a normal browser request: the page loads again with the response. The router does not take over plain form submits. (The [forms library](../forms/forms.md) can send them in the background once its code has loaded.)

## Redirect after the change

Return `redirect(url)` when the action is done. From an action, a redirect without a status answers `303 See Other`, so the browser loads `url` with `GET`. This pattern is called Post/Redirect/Get: if the visitor reloads the page afterwards, the browser does not send the form a second time. Pass a status to override it, for example `redirect(url, 307)`.

## Show errors with `fail()` and `actionResult()`

When the input is wrong, return `fail(status, data)`. The router then runs the loaders again, renders the page with that status (for example `400`), and hands `data` to the page. The page reads it with `actionResult(name)` from `@rivetjs/router/client`:

```tsx title="src/routes/index.tsx"
import { fail, redirect, type RequestEvent, actions } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";

export const forms = actions({
  sign: async ({ request }: RequestEvent) => {
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const text = String(form.get("text") ?? "").trim();
    if (!name || !text) return fail(400, { error: "Please fill in both fields.", name, text });
    // … save …
    return redirect("/");
  },
});

export default function Guestbook() {
  const sign = actionResult<"index", "sign">("sign");
  const failed = sign?.status !== undefined ? sign.result : undefined;
  return (
    <form method="post" action="?/sign">
      {failed ? <p role="alert">{failed.error}</p> : null}
      <input name="name" value={failed?.name ?? ""} />
      <textarea name="text">{failed?.text ?? ""}</textarea>
      <button>Sign</button>
    </form>
  );
}
```

- `actionResult("sign")` returns `{ name, result, status? }` when this render answers a post to `?/sign`, else `undefined`. Without a name it returns the result of any action.
- The type arguments `<"index", "sign">` (route id, action name) type `result` from the action: its return value on success, or the `data` of `fail(status, data)` together with `status: number`. Check `status !== undefined` to narrow to the failure. See [typed routes](./typed-routes.md).
- Call it at the top of the component, like other setup code. It reads the request the page is rendered for.
- Send back what the visitor typed, so they do not lose it. Do not send back passwords.
- `fail()` takes a 4xx status only. For a missing record use `notFound()`.

::api{symbol="@rivetjs/router#fail"}

## What an action can return

| Return value | Response |
| --- | --- |
| `redirect(url)` | `303`; the browser goes to `url`. The usual choice after success. |
| `fail(status, data)` | The page renders again with `status`; `actionResult()` gives `data`. |
| `notFound()`, `deny()`, `error(status, message)` | That status, with the nearest `_404.tsx` or `_error.tsx`. You can `return` or `throw` them. |
| a `Response` | Sent as it is. |
| anything else | The loaders run again and the page renders with status `200`; `actionResult()` gives the value. |

Prefer a redirect after success: a page rendered as the answer to a `POST` sends the form again if the visitor reloads it.

## Guards, cookies and `locals`

Before an action runs, all guards of the page and its layouts run, just like for a page load. A guard that protects the page also protects its actions. The action gets the same event as a loader, so it can read `locals.user`, set cookies and set headers:

```tsx title="src/routes/login.tsx"
import { fail, redirect, type RequestEvent, actions } from "@rivetjs/router";
import { checkPassword, createSession } from "../sessions.server.ts";

export const forms = actions({
  login: async ({ request, cookies }: RequestEvent) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "");
    const user = await checkPassword(email, String(form.get("password") ?? ""));
    if (!user) return fail(400, { error: "Wrong email or password.", email });
    cookies.set("session", await createSession(user), { maxAge: 60 * 60 * 24 });
    return redirect("/account");
  },
});
```

## Cross-site protection

Actions change data, so Rivet rejects form posts from other sites. If the request has an `Origin` header, it must match the page's origin. If not, the `Sec-Fetch-Site` header, when present, must be `same-origin`. A form post with neither header is rejected too (outside dev). Otherwise the response is `403` and the action does not run. You do not need a CSRF token for actions.

The same check runs for every `POST`, `PUT`, `PATCH` and `DELETE` request, on pages and [endpoints](./endpoints.md) alike, before request handlers, guards and actions. The forms library's `action()` adds a stricter check on top (see [forms](../forms/forms.md)).

## Other request details

- Posting to a page without `?/name` gives `405 Method Not Allowed`. An unknown action name gives `404`.
- A request with `Accept: application/json` gets data instead of a page: the body holds `{ action: { name, result, status? } }` (or `{ redirect }`, or `{ error }`), written in the format the router uses for route data. The forms library uses this for submits in the background.
- File inputs need `enctype="multipart/form-data"` on the form; `form.get("file")` is then a `File`.

:::warning
The router does not limit the size of request bodies. Check `File.size` and text lengths in your action and set a body size limit in your proxy, or use the forms library's `action()`, which caps body size.
:::

## Common mistakes

- **`<form action="/add">`.** That posts to a different URL. Use `action="?/add"`, the page's own URL plus the action name.
- **Forgetting `method="post"`.** A `GET` form puts the fields in the URL and never runs an action.
- **Calling `actionResult()` inside an event handler.** It answers during rendering of the page. In the browser it returns each result once, so later renders start clean.
- **Losing the query string.** Posting to `?/login` replaces the page's query, so `?next=/account` is gone inside the action. Send such values in a hidden field: `<input type="hidden" name="next" value={data.next} />`.
- **Using actions in a static site.** Actions need a server. A form on a static page has nothing to post to.

## See also

- [Forms](../forms/forms.md): typed fields, schema checks and background submits
- [Guards](./guards.md)
- [Forms and input](/guides/components/forms-and-input.md): reading input in the browser
- [Login form recipe](/recipes/login-form.md)
