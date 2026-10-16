---
title: Plurals and formatting
description: Write plural, select, number and date messages with ICU syntax, and learn what each one costs in the browser.
template: guide
status: experimental
related: [guides/i18n/translating-text, guides/i18n/locale-urls]
---

Languages count things differently. English has "1 item" and "2 items"; other languages have more forms. Numbers and dates also look different in each language. `@rivetjs/i18n` handles this with ICU MessageFormat in your catalogs and the browser's built-in `Intl` API.

This page shows how to write plurals, choices, numbers and dates. It assumes you have set up the plugin as in [Translating text](translating-text.md).

## Plurals

Use `plural` and give one case per form. `#` is replaced by the number:

```json title="locales/en.json"
{
  "cart": {
    "count": "{n, plural, one {# item} other {# items}}"
  }
}
```

```json title="locales/de.json"
{
  "cart": {
    "count": "{n, plural, one {# Artikel} other {# Artikel}}"
  }
}
```

```tsx
<p>{t("cart.count", { n: items.length })}</p>
```

The case names (`zero`, `one`, `two`, `few`, `many`, `other`) follow the plural rules of each language. English uses only `one` and `other`. Ukrainian uses three forms for whole numbers: `one` for 1, 21, 31 ("товар"), `few` for 2–4, 22–24 ("товари") and `many` for 0, 5–20, 25–30 ("товарів"); `other` covers fractions. Click + in the example below, then switch to Українська. The badge shows the case that `Intl.PluralRules` picks for the number:

::example{id=i18n-plurals}

Each language is its own page (`/` and `/uk`), so the switcher is a plain link that loads the other page, and the counter starts again at 0. See [Locale URLs](locale-urls.md#link-to-another-language).

You can also match an exact number with `=0`:

```json
{ "inbox": "{n, plural, =0 {No messages} one {# message} other {# messages}}" }
```

Rules:

- `other` is required. A plural without it is a build error that names the language and key, for example `de:cart.count`.
- `offset` is not supported.
- `#` outside a plural is an error.

For ordinal numbers ("1st", "2nd"), use `selectordinal`:

```json
{ "place": "{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}" }
```

## Choices

`select` picks a case by a string value:

```json
{ "invite": "{gender, select, female {She invited you} male {He invited you} other {They invited you}}" }
```

```tsx
<p>{t("invite", { gender: user.gender })}</p>
```

The generated types list the known cases, so your editor suggests `"female"`, `"male"` and `"other"`. `other` is required here too.

## Numbers

| Message | Result (en) |
| --- | --- |
| `{x, number}` | `1,234.5` |
| `{x, number, integer}` | `1,235` |
| `{x, number, percent}` | `25%` for `0.25` |
| `{x, number, ::currency/EUR}` | `€1,234.50` |

The `::` form is an ICU number skeleton. Named styles other than `integer` and `percent` are build errors (`unknown number style`).

```json
{ "total": "Total: {amount, number, ::currency/EUR}" }
```

```tsx
<p>{t("total", { amount: cart.total })}</p>
```

The parameter type is `number`.

## Dates and times

| Message | Meaning |
| --- | --- |
| `{d, date}` | Default date format |
| `{d, date, short}` | Also `medium`, `long`, `full` |
| `{d, time, short}` | Time of day, same styles |

The parameter accepts a `Date` or a timestamp number. Set `timeZone` in the plugin options so the server and browser format the same way.

```json
{ "updated": "Updated {at, date, medium}" }
```

```tsx
<p>{t("updated", { at: post.updatedAt })}</p>
```

## What it costs

- Plain text messages become strings in the compiled code. Nothing is loaded at runtime.
- Only messages with `plural`, `select`, `number` or `date` import a small helper (`@rivetjs/i18n/runtime`). It reuses one `Intl` formatter per language and options.
- Plural rules and formats come from `Intl` in the browser and in Node.js. No locale data is shipped with your app.

## Common mistakes

### Numbers and dates in English on the server

If Node.js was built without full ICU data, `Intl` falls back to English. The plugin prints a warning at startup ("Node lacks full ICU"). Official Node.js builds include full ICU.

### Tags in attributes

A tag such as `<b>`, at the top level or inside a `plural` or `select` case, makes the message JSX content. It works in JSX children, variables and props, but not in an attribute or `t.in`, which need a string. Use a message without tags there.

### Parameters that differ between languages

Each language must use the same parameter names for a key. If a translator renames `{n}` to `{count}`, the build fails with `params differ between "en" (n) and "de" (count)`.

## See also

- [Translating text](translating-text.md)
- [Locale URLs](locale-urls.md)
