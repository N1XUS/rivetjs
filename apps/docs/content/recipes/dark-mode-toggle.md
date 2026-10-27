---
title: Dark mode toggle
description: Build a theme button with system, light and dark choices that is saved in the browser and applied before the page paints.
template: recipe
related: [guides/state/effects, guides/components/browser-only, guides/styling/css-and-tailwind, guides/security/csp]
---

## What you will build

A button that cycles through three themes: **system** (follow the operating system), **light** and **dark**. The choice is saved in `localStorage`. On the next visit the page opens in the saved theme, with no flash of the wrong colours.

::example{id=dark-mode-toggle}

## How it works

The theme has two parts that run at different times:

1. A tiny inline script in the document `<head>` sets `data-theme` on `<html>` before the first paint.
2. The page component keeps the current choice in a signal, so the button label can change.

### 1. Apply the theme before the page paints

The server does not know what the visitor saved in their browser. So the server cannot pick the colours. A small script in `src/document.ts` reads `localStorage` (or the system setting) and writes `data-theme="dark"` or `data-theme="light"` on `<html>`. It runs before the browser draws anything.

```ts title="src/document.ts"
const themeScript =
  'try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}';

// inside start: … `<script${nonce ? ` nonce="${nonce}"` : ""}>${themeScript}</script>` …
```

The script is wrapped in `try` because storage can be blocked (for example in some private windows).

### 2. Make Tailwind's `dark:` follow the attribute

By default Tailwind's `dark:` variant follows the system setting. One line in the stylesheet makes it follow `data-theme` instead:

```css title="src/styles.css"
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

Now `dark:bg-slate-900` applies whenever `<html data-theme="dark">` is set.

### 3. Keep the choice in a signal

The component starts with `signal<Choice>("system")`. That is what the server renders, because it cannot read `localStorage`.

Browser code goes in three places, never at the top of the component:

- `clientEffect(…, { when: "load" })` reads the saved choice once the page has loaded and updates the signal. The label then shows the saved choice.
- `clientEvent("media:(prefers-color-scheme: dark)", "change", …)` listens for operating system changes. While the choice is "system", it updates `data-theme`.
- The `onClick` handler moves to the next choice, writes `data-theme` and saves (or removes) the value in `localStorage`.

Remember that a component renders on the server, and in the browser only once it is used, over the server's HTML. Code at the top level of the component must give the same result in both places. That is why `localStorage`, `matchMedia` and `document` only appear inside the effect, the client event and the handler. See [window is not defined](/gotchas/window-is-not-defined.md) for the error you get otherwise.

### 4. What loads, and when

The click handler is in its own small chunk. The browser fetches it at low priority when idle after the page has loaded (or as soon as the visitor points at or focuses the button) and runs it on the first click. The effect and the media listener need the Rivet runtime, which starts when the page has loaded.

## Variations

- **Two states only.** Drop "system" and toggle between light and dark. Keep the inline script: it still avoids the flash.
- **No label.** If the button shows icons instead of text, render both icons and let CSS show the right one (`dark:hidden` and `hidden dark:inline`). Then the server HTML is always right, and you do not need the `clientEffect`.
- **Saved per account.** For signed-in users, also save the choice on the server (an [action](/guides/routing/actions-and-forms.md)) and read it in a loader. Then the server can render `data-theme` directly.

## Watch out

- **Inline scripts and CSP.** A server app sends a strict Content Security Policy by default, so inline scripts need the `nonce` the document shell receives. A static build allows its inline scripts by hash instead. See [Content Security Policy](/guides/security/csp.md).
- **The label can change after load.** With a saved choice, the button says "system" for a moment, until the effect runs. The colours are right from the start, because the inline script set them.
- **Storage can fail.** Always wrap `localStorage` in `try`/`catch`.
