---
title: Browser-only code
description: Use window, document, localStorage and browser-only libraries safely with handlers, clientEffect, clientEvent and clientOnly.
template: guide
related: [gotchas/window-is-not-defined, guides/state/effects, guides/components/refs]
---

Your components first run on the server, where there is no `window`, no `document` and no `localStorage`. After reading this page you know the four places where browser code is allowed, and which one to pick.

## The rule

Read browser globals only in:

1. **event handlers** in JSX, like `onClick`,
2. **`clientEffect`**: code that runs in the browser when the page is ready, and again when signals change,
3. **`clientEvent`**: listeners on `window`, `document`, an element or a media query,
4. **`clientOnly`** components: modules that only ever load in the browser.

Anywhere else, the compiler stops with an error like this:

```txt
Browser global `document` is read during server rendering; move it into a handler, clientEffect or clientEvent
```

This also applies to helper functions at module level that a component calls while rendering. See [window is not defined](/gotchas/window-is-not-defined.md).

## In a handler

Handlers run only in the browser, so you can use anything there:

```tsx
<button type="button" onClick={() => navigator.clipboard.writeText(code)}>
  Copy
</button>
```

## Run code when the page is ready: clientEffect

```tsx
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";

export default function Settings() {
  const dark = signal(false);
  clientEffect(() => {
    // Runs in the browser: read the saved choice once.
    dark.set(localStorage.getItem("theme") === "dark");
  });
  clientEffect(() => {
    // Runs again whenever `dark` changes.
    document.documentElement.classList.toggle("dark", dark());
    localStorage.setItem("theme", dark() ? "dark" : "light");
  });
  return (
    <label>
      <input type="checkbox" model:checked={dark} /> Dark mode
    </label>
  );
}
```

`clientEffect` never runs on the server. The `when` option can wake the component at idle or near the viewport. On resumed pages, `"interaction"` and `"media:(query)"` currently wait for another reason to adopt the component rather than installing a page-wide or media trigger. See [effects](../state/effects.md#choose-when-it-starts) and the [dark mode recipe](/recipes/dark-mode-toggle.md).

## Listen to browser events

`clientEvent(target, type, handler, options?)` adds a listener on `window`, `document`, a [ref](./refs.md)-bound element, or a media query:

```tsx
import { signal } from "@rivetjs/reactivity";
import { clientEvent } from "@rivetjs/runtime/dom";

export function WindowSize() {
  const width = signal(0);
  clientEvent(window, "resize", () => width.set(innerWidth));
  clientEvent("media:(prefers-color-scheme: dark)", "change", (event: MediaQueryListEvent) => console.log(event.matches));
  return <p>Width after the last resize: {width()}</p>;
}
```

Options:

| Option | Meaning | Default |
| --- | --- | --- |
| `when` | When the resumed component wakes: `"load"`, `"idle"`, `"visible"`; `"interaction"` and `"media:…"` wait for another reason to adopt | `"idle"` |
| `passive` | Passive listener | `true` for `scroll`, `wheel`, `touchstart`, `touchmove`, `touchend`, `pointermove`, `resize` |
| `capture` | Listen in the capture phase | `false` |
| `once` | Remove after the first event | `false` |
| `standalone` | Whether this listener alone can wake a resumed component; `false` waits for another reason to adopt | `true` |
| `match` | Run only when the event target is inside an element matching this CSS selector | none |
| `preload` | Accepted by the type, but has no effect on derived resume | none |

The listener attaches when its component adopts, at idle by default. Code fetching follows the page's [preloading policy](../performance/preloading.md); `preload` does not select a separate handler chunk. With `standalone: false`, this listener alone ships no JavaScript. The handler runs inside a [batch](../state/batching.md). The listener is removed when its part of the page goes away.

For a simple listener in JSX, `window:onKeyDown={…}` and `document:onClick={…}` also work. See [events](./events.md#listen-on-window-or-document).

::api{symbol="@rivetjs/runtime/dom#clientEvent"}

## A component that only runs in the browser

Some libraries touch `window` as soon as you import them: maps, charts, editors. Put such code in its own module and load it with `clientOnly`:

::example{id=client-only-widget}

```tsx
import { clientOnly } from "@rivetjs/runtime/dom";

const MapView = clientOnly(() => import("../components/Map.tsx"), undefined, {
  fallback: () => <p>Loading the map…</p>,
});

export default function Page() {
  return <MapView lat={52.37} lng={4.9} />;
}
```

- On the server, the compiler removes the import. The server renders the `fallback` with the same props.
- In the browser, the module loads when the component renders. On a server-rendered page that is when it comes near the screen (`when: "visible"`, the default; also `"load"` and `"idle"`). Rendered later, for example after a click as in the example above, it loads right then. The fallback shows until it arrives.
- The module may read browser globals anywhere, even at its top level, because the server never loads it.

Write the import inline, as above. The compiler needs to see `() => import("…")` and a selector that is inline or `undefined`; otherwise it reports `Server clientOnly erasure requires an inline importer and inline selector or undefined`.

::api{symbol="@rivetjs/runtime/dom#clientOnly"}

## Which one to use

| You want to | Use |
| --- | --- |
| React to a click or key press | A handler |
| Sync with the browser when state changes | `clientEffect` |
| Listen on `window`, `document` or a media query | `clientEvent` or `window:onX` |
| Use a library that needs `window` to load | `clientOnly` |

## Common mistakes

- **`typeof window !== "undefined"` checks in component code.** The component renders on the server and again over the server's HTML in the browser, so the two branches give different markup and the component renders in the browser instead of reusing the server nodes. Use one of the four tools above.
- **Reading a browser value into a signal at the top of the component.** Read it in a `clientEffect` and `set` the signal there.
- **Forgetting the fallback.** Without it, `clientOnly` renders nothing on the server, and the layout jumps when the component appears. Give the fallback the same size.

## See also

- [Effects](../state/effects.md)
- [Refs](./refs.md)
- [Window is not defined](/gotchas/window-is-not-defined.md)
