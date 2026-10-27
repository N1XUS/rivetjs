---
title: Login form
description: A sign-in form handled by a server action that checks a hashed password, starts a session in an HttpOnly cookie and redirects safely.
template: recipe
related: [recipes/protected-pages, guides/routing/actions-and-forms, guides/forms/forms, best-practices/secrets-in-server-files]
---

## What you will build

A sign-in page at `/login`. The form posts to a server action. With the right email and password, the action starts a session and redirects. With the wrong ones, the form comes back with a message and the email filled in.

The form is plain HTML. It works before any JavaScript loads, and with JavaScript turned off. The example needs a server, so it is shown as code. Copy it into the server starter and sign in with `demo@example.com` and `rivet-demo`.

::example{id=login-form}

## How it works

### 1. The form posts to a named action

```tsx
<form method="post" action="?/login">
  <input type="hidden" name="next" value={next} />
  <input name="email" type="email" autoComplete="username" required />
  <input name="password" type="password" autoComplete="current-password" required />
  <button>Sign in</button>
</form>
```

`action="?/login"` runs the `login` function in the `actions(…)` of `login.tsx`. The `autoComplete` values let password managers fill the fields.

### 2. The action checks the password on the server

```tsx title="src/routes/login.tsx"
import { actions, type RequestEvent, fail, redirect } from "@rivetjs/router";

export const forms = actions({
  login: async ({ request, cookies }: RequestEvent) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const next = safeNext(String(form.get("next") ?? ""));
    const name = checkPassword(email, password);
    if (!name) return fail(400, { email, next, message: "Wrong email or password." });
    startSession(cookies, name);
    return redirect(next, 303);
  },
});
```

- `checkPassword` lives in `src/auth.server.ts`, imported only by the server exports. Files ending in `.server.ts` can never be part of browser code: the build stops with an error if the component uses one.
- The demo stores a **salted scrypt hash**, never the password. It compares with `timingSafeEqual`, so the response time does not reveal how close a guess was.
- The message does not say whether the email or the password was wrong. That makes it harder to find out which emails have accounts.

### 3. A failed sign-in renders the form again

`fail(400, data)` answers with status 400 and renders the page again. The page reads the data with `actionResult`:

```tsx
import { actionResult } from "@rivetjs/router/client";

const failed = actionResult<"login", "login">("login");
// failed?.status !== undefined → failed.result is the fail() data
```

The data holds the email (so the user does not type it again) and the message. It never holds the password.

### 4. A successful sign-in sets a cookie and redirects

`startSession` creates a random session id and stores it with `cookies.set("session", id, { maxAge: … })`. Rivet cookies are `HttpOnly`, `Secure` and `SameSite=Lax` unless you choose otherwise. So page scripts cannot read the session id, and other sites cannot send it with their forms.

Then the action returns `redirect(next, 303)`. This is **Post/Redirect/Get**: the browser loads the next page with a normal GET. Reloading it does not send the password again.

### 5. `next` must stay on your site

After sign-in the user goes back to the page they wanted (`/login?next=/account`). The value comes from the URL, so anyone can change it. `safeNext` accepts only paths that start with one `/`. It refuses `https://evil.example`, `//evil.example` and `/\evil.example`, which browsers would treat as another site.

### 6. Signing out is an action too

`index.tsx` has a `logout` action in its `actions(…)` that deletes the session and the cookie. Use a form with a button for it, not a link: a GET request should never change state.

## Variations

- **Validation with a schema.** The [forms guide](/guides/forms/forms.md) shows `@rivetjs/forms`: field errors, a schema, and validation in the browser before the post.
- **Protect pages.** Check the session in a guard. See [protected pages](./protected-pages.md).
- **Remember me.** Leave out `maxAge` for a cookie that ends when the browser closes, or offer a checkbox to choose.

## Watch out

- **The demo stores everything in memory.** A restart signs everyone out. A real app keeps users and sessions in a database.
- **Use HTTPS.** `Secure` cookies are only sent over HTTPS. Browsers make an exception for `localhost`, so local development works.
- **Limit attempts.** Add rate limiting (per IP and per account) before you go live.
- **Cross-site posts are rejected.** Rivet refuses action posts whose `Origin` is another site (status 403). Your own forms pass.
