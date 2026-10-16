---
title: Server first
description: Why Rivet renders every page on the server first, what runs where, and what that means for the code you write.
template: concept
status: experimental
related: [learn/resuming, learn/rendering-modes, guides/security/server-only-code, guides/components/browser-only]
---

In Rivet, the server makes the page. Every page starts as HTML written by your components on the server (or at build time). The browser gets a finished page, then adds behaviour only where you need it.

## What it is

"Server first" means the default place for your code is the server:

- **Components** run on the server and produce HTML. This is called :term[server rendering]{id=server-rendering}.
- **Data loading, access checks and form handling** live in the page file, in server exports such as `serverLoad`. They never reach the browser.
- **The browser** receives HTML, CSS and a small loader script. It runs only event handlers, client effects and the updates that a changed signal causes.

You opt in to browser code piece by piece, by writing an event handler or a client effect. You do not opt out of it.

## Why it matters

- **Content appears fast.** The HTML already contains the text, images and links. The browser can show it before any JavaScript runs.
- **Less code in the browser.** A component that only shows data never ships its code. A page with one button ships the code for that button.
- **Secrets stay on the server.** Database clients, API keys and private logic in `.server.ts` modules are not part of the browser build.
- **Links and forms work without JavaScript.** A plain `<a href>` navigates. A `<form method="post">` posts to the page's server code. Once the router's script has loaded, link clicks swap only the page instead of reloading the document, but links work before that too.

## How it works

A page with server code is one file. Exports whose names start with `server` run only on the server; the compiler removes them, and everything only they use, from the browser build:

```tsx title="src/routes/notes.tsx"
import { redirect, type PageProps, type RequestEvent } from "@rivetjs/router";

const notes: string[] = []; // used only by the server exports: never reaches the browser

// Runs on the server for each request. The result reaches the page as `data`.
export const serverLoad = () => ({ notes });

export const serverActions = {
  // Handles <form method="post" action="?/add">.
  add: async ({ request }: RequestEvent) => {
    const text = String((await request.formData()).get("text") ?? "").trim();
    if (text) notes.push(text);
    return redirect("/notes", 303);
  },
};

export default function Notes({ data }: PageProps<typeof serverLoad>) {
  return (
    <main>
      <ul>
        {data.notes.map((note) => (
          <li>{note}</li>
        ))}
      </ul>
      <form method="post" action="?/add">
        <input name="text" required />
        <button>Add</button>
      </form>
    </main>
  );
}
```

For one request, this happens:

1. The request arrives. The router finds `notes.tsx` and its server exports.
2. It runs `serverLoad` and gets `{ notes }`.
3. It runs the `Notes` component with that data and streams the HTML to the browser.
4. The browser shows the page. Nothing in this page needs JavaScript: there are no handlers and no state.
5. When you submit the form, the browser posts it. The `add` action saves the note and redirects back to `/notes`, which renders again with the new note.

The [server starter](../start/quick-start.md#starters) is this pattern in a working project.

## What runs where

| Code | Server | Browser |
| --- | --- | --- |
| Server exports: `serverLoad`, `serverActions`, `serverGuard`, `serverHeaders`, `onGet`/`onPost`; `.server.ts` modules | yes | never |
| Component body (the code before `return`) | once per render | never |
| JSX output | written as HTML | not rendered again; only changed parts update |
| Event handlers (`onClick`, `onSubmit`, …) | recorded, not run | when the event happens |
| `clientEffect(fn)` | recorded, not run | at the time you choose (`load`, `idle`, `visible`, …) |
| Signals | created, values saved into the page | read from the saved values on first use |

## What it means for your code

- **Do not read browser globals in a component body.** `window`, `document` and `localStorage` do not exist on the server. The compiler stops with an error such as "Browser global `document` is read during server rendering; move it into a handler, clientEffect or clientEvent". See [window is not defined](../gotchas/window-is-not-defined.md).
- **Put browser work in handlers or client effects.** For example, read `localStorage` inside `clientEffect`, then write the value into a signal. See [browser-only code](../guides/components/browser-only.md).
- **Keep secrets in `.server.ts` files.** A `.tsx` page or component is built for the browser too; only its server exports are removed. See [secrets in server files](../best-practices/secrets-in-server-files.md).
- **Pass data, not services.** A component gets plain data from `serverLoad`, not a database client. See [pass data, not services](../best-practices/pass-data-not-services.md).
- **Design for "works without JavaScript" first.** Use links and forms for navigation and changes. Add handlers for what needs to be instant. See [links and forms without JS](../best-practices/links-and-forms-without-js.md).

## Related

- [Resuming](resuming.md): how the browser continues from the server's HTML.
- [Rendering modes](rendering-modes.md): per request, at build time, or in the browser only.
- [Loading data](../guides/routing/loading-data.md) and [actions and forms](../guides/routing/actions-and-forms.md).
