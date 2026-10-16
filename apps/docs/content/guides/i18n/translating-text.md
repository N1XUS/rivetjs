---
title: Translating text
description: Set up @rivetjs/i18n, write message catalogs, and translate text with t() so each language is built into the page with no runtime cost.
template: guide
status: experimental
related: [guides/i18n/plurals-and-formatting, guides/i18n/locale-urls, guides/tooling/vite]
---

`@rivetjs/i18n` translates your app at build time. You write messages in JSON files, one per language, and call `t("key")` in your components. The compiler replaces each call with the text for the language being built. The browser gets plain strings: no message catalog and no translation library.

After reading this page you can set up the plugin, write catalogs, translate text and attributes, and build one version of the app per language.

::example{id=i18n-messages}

## Set up the plugin

Put the shared settings in one file, so the Vite plugin and the router guard use the same values:

```ts title="i18n.config.ts"
import type { I18nRouteConfig } from "@rivetjs/i18n/router";

export const config = {
  locales: ["en", "de"],
  defaultLocale: "en",
  catalogs: "locales/{locale}.json",
  routing: { prefix: "as-needed" },
} satisfies I18nRouteConfig & { catalogs: string };
```

Add `i18n()` to the Vite plugins, **before** `rivetRouter()` (or `rivet()`):

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { i18n } from "@rivetjs/i18n/vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { config } from "./i18n.config.ts";

export default defineConfig({
  plugins: [i18n(config), rivetRouter()],
});
```

Main options:

| Option | Meaning |
| --- | --- |
| `locales` | Every language you support. The order matters for the build. |
| `defaultLocale` | The main language. Every key must exist here. |
| `catalogs` | Path with `{locale}`, relative to the project root, or a function `(locale) => object`. |
| `fallback` | Per-language fallback, for example `{ "de-AT": "de" }`. Every chain ends at the default language. |
| `missing` | What happens when a non-default language lacks a key: `"error"` (default), `"warn"` or `"fallback"`. The dev server uses `"warn"` unless you set it. |
| `timeZone` | Time zone for date formatting. |
| `dts` | Where the generated types go (default `src/rivet-i18n.d.ts`). |

## Write catalogs

A catalog is a JSON file. Nested objects become dotted keys:

```json title="locales/en.json"
{
  "cart": {
    "title": "Cart",
    "greeting": "Hello, {name}!"
  }
}
```

```json title="locales/de.json"
{
  "cart": {
    "title": "Warenkorb",
    "greeting": "Hallo, {name}!"
  }
}
```

Values use ICU MessageFormat, a common format for translations. `{name}` is a parameter.

Every language must use the same parameters for a key. If `en` has `{name}` and `de` does not, the build fails with a clear message.

## Translate text

Import `t` and call it with a key:

```tsx title="src/routes/[[lang]]/index.tsx"
import { t } from "@rivetjs/i18n";

export default function Cart(props: { name: string }) {
  return (
    <main>
      <h1>{t("cart.title")}</h1>
      <p>{t("cart.greeting", { name: props.name })}</p>
      <input placeholder={t("cart.title")} />
    </main>
  );
}
```

Rules the compiler checks:

- The key must be a string literal, so the compiler can find it.
- Parameters must be an object literal, written in the call.
- Unknown keys, missing parameters and extra parameters are build errors (for example `Unknown message key "nope"` or `Missing param "name" for "cart.greeting"`).

The plugin writes `src/rivet-i18n.d.ts` with every key and its parameters, so your editor also reports these mistakes.

### Text that changes

A message can read a signal. Then it updates like any other text:

```tsx
import { signal } from "@rivetjs/reactivity";
import { t } from "@rivetjs/i18n";

export default function Counter() {
  const n = signal(1);
  return (
    <button type="button" onClick={() => n.set(n() + 1)}>
      {t("cart.count", { n: n() })}
    </button>
  );
}
```

Messages that do not read signals add nothing to the page state.

### Links and bold text inside a message

Messages can contain tags. `b`, `i`, `em`, `strong`, `code`, `br` and `small` work without extra code. Other tags need a parameter that returns JSX:

```json
{ "terms": "I accept the <link>terms</link>." }
```

```tsx
<p>{t("terms", { link: (c) => <a href="/terms">{c}</a> })}</p>
```

A message with tags is JSX content, so you can also keep it in a variable, return it from a function or pass it as a prop:

```tsx
import type { Content } from "@rivetjs/runtime/jsx-runtime";

function Alert(props: { message: Content }) {
  return <div role="alert">{props.message}</div>;
}

<Alert message={t("terms", { link: (c) => <a href="/terms">{c}</a> })} />;
```

Attributes and `t.in` give strings, so they cannot hold tags. The build fails there with "Message tags ... are not supported in an attribute". Use a message without tags in those places.

### Keys chosen at runtime

When the key depends on a value, use a template literal with a fixed prefix:

```tsx
<a href={`/${id}`}>{t(`nav.${id}`)}</a>
```

The compiler includes every key under `nav.`. These keys cannot take parameters. An unknown key gives an empty string (the dev server also logs a warning). TypeScript accepts the template when some key starts with `nav.`; a fixed key such as `t("nav.hmoe")` is still checked exactly.

### Text outside a page render

In server code that runs outside rendering, such as an email in an [action](../routing/actions-and-forms.md), pass the language yourself with `t.in`:

```ts
import { t } from "@rivetjs/i18n";

const subject = t.in("de", "cart.title");
```

## Build one app per language

Each language gets its own browser build, with its text inlined. Set `RIVET_LOCALE` for each client build, then run one server build:

```bash
RIVET_LOCALE=en vite build
RIVET_LOCALE=de vite build
vite build --ssr
```

Client builds go to `dist/client/<locale>/`, served under `/<locale>/`. A client build without `RIVET_LOCALE` fails on purpose. The server build contains every language.

Serve it with the Node adapter and list the locales:

```ts title="serve.js"
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({ dist: "dist", locales: ["en", "de"] });
closeOnSignals(serving);
```

Each page loads the browser code of its own language. To pick the language from the URL, see [Locale URLs](locale-urls.md).

## In the dev server

The dev server renders every language from one server, without per-language builds:

- A page in another language than `defaultLocale` (for example `/uk`) loads its browser code with `?rivet-locale=uk`. Every app module it imports keeps the query, so handlers and signal-driven text in the browser use that page's language too.
- A key missing in a non-default language logs `[rivet:i18n] extra: missing in "uk", using "en"` in the terminal, with a `fix:` line naming the `uk` catalog file to add it to, and shows the default-language text, because the dev server uses `missing: "warn"` unless you set `missing` yourself. The production build fails on it (`"error"`, the default).
- After a catalog edit, the page reloads fully.
- A link to another language loads that page as a new document, as in a build: the client router never switches the language in place.
- `_404` and `_error` pages for unmatched URLs take the language of the URL prefix, as in a build without `resolveLocale`; see [Locale URLs](locale-urls.md#error-pages-in-the-right-language).

## Limits

- No in-place language switch: changing the language is a navigation to another URL.
- If Node.js is built without full ICU data, numbers and dates format in English. The plugin warns about this.

## Common mistakes

- **`t() was not compiled`.** `i18n()` is missing from the Vite plugins, or comes after `rivetRouter()` / `rivet()`.
- **A key or parameter in a variable.** `t(key)` or `t("cart.greeting", params)` cannot be checked by the compiler. Write the key as a literal (or a template literal with a fixed prefix) and the parameters as an object literal.
- **`String(t("…"))` in server code outside JSX.** On the server a message is a value per language; converting it throws. Use `t.in(locale, "…")`.
- **Tags in an attribute.** `placeholder={t("terms", …)}` with a `<link>` message fails the build. Use a message without tags.
- **Testing a language only in the dev server.** Missing keys are warnings there and errors in the build. Run the build before you ship a new catalog.

## See also

- [Plurals and formatting](plurals-and-formatting.md)
- [Locale URLs](locale-urls.md)
