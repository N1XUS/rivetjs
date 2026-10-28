---
title: Trusted Types
description: Turn on Trusted Types so the browser blocks HTML strings written into the page, and learn which policy Rivet needs.
template: guide
status: experimental
related: [guides/security/csp, guides/components/refs, guides/components/browser-only]
---

:term[Trusted Types]{id=trusted-types} is a browser feature that blocks a common kind of attack: writing an untrusted string into the page as HTML, for example with `element.innerHTML = userInput`. When Trusted Types is enforced, such writes fail unless the value comes from a named policy that you allow.

Rivet works with Trusted Types. After reading this page you can turn it on, and you know what to do if your own code writes HTML.

## Why Rivet apps are a good fit

Rivet's JSX never writes your strings as HTML:

- Text in `{...}` is always inserted as text, never parsed as HTML.
- JSX rejects `innerHTML`, `dangerouslySetInnerHTML` and `srcdoc` as attributes. The compiler reports an unsafe attribute.
- Event handlers are functions, never strings.

The runtime has exactly one place where it parses HTML: the static markup of compiled templates. That markup comes from the compiler, with all text escaped. It goes through a Trusted Types policy named `rivet`. The [kit](../../ui/kit.md)'s head components write scripts (deferred `<Script>` files, `<JsonLd>` data) through a second policy, `rivet-script`.

## Turn it on

Trusted Types is part of the [Content Security Policy](csp.md). Two directives turn it on:

```txt
require-trusted-types-for 'script'; trusted-types rivet rivet-script
```

You do not need to write them by hand. The CSP helpers add them with the `trustedTypes` option.

### Static sites

```js title="prerender.js"
import { prerenderBuild } from "@rivetjs/router/static";

await prerenderBuild({ dist: "dist", csp: { trustedTypes: true } });
```

Each page then gets:

```txt
script-src 'sha256-…' 'self'; object-src 'none'; base-uri 'none'; require-trusted-types-for 'script'; trusted-types rivet rivet-script
```

### Server pages

```ts
import { strictCSP } from "@rivetjs/router/server";

const policy = (nonce: string) => strictCSP(nonce, { trustedTypes: true });
```

Pass this function as `csp` to `createApp({ csp: policy })`. With `start()` from `@rivetjs/router/node`, pass `csp: { trustedTypes: true }`. See [Content Security Policy](csp.md#change-or-turn-off-the-policy).

## Your own HTML

Sometimes you need to write HTML yourself, for example rendered Markdown, in a `ref` or a `clientEffect`. With Trusted Types enforced, a plain string fails. Create your own policy and allow its name:

```tsx title="src/components/Article.tsx"
import { clientEffect } from "@rivetjs/runtime/dom";

type Policy = { createHTML(value: string): string };
type TrustedTypes = { createPolicy(name: string, rules: Policy): Policy };
let articlePolicy: Policy | undefined;

export function Article(props: { html: string }) {
  let box!: HTMLDivElement;
  clientEffect(() => {
    // Only for HTML you have cleaned (sanitized) on the server.
    const tt = (window as unknown as { trustedTypes?: TrustedTypes }).trustedTypes;
    const policy = (articlePolicy ??= tt?.createPolicy("article", { createHTML: (value) => value }));
    box.innerHTML = policy ? policy.createHTML(props.html) : props.html;
  });
  return <div ref={(el) => (box = el)} />;
}
```

Then list the policy name in the option. `rivet` and `rivet-script` are always included:

```js
await prerenderBuild({ dist: "dist", csp: { trustedTypes: ["article"] } });
// trusted-types rivet rivet-script article
```

A policy is only as safe as its `createHTML` function. A policy that returns the value unchanged, like the one above, is safe only for HTML that is already clean. For user content, clean it first with a sanitizer library.

A policy name can be created only once per page. Create it once, outside code that runs many times, if you write HTML often.

## Check that it works

1. Build and serve the site.
2. Open the page and check the response headers (or the `<meta>` tag on static pages) for `require-trusted-types-for`.
3. Use the page. Open the **Console**: Trusted Types errors say which sink was blocked, for example `innerHTML`.

Browser support differs. Chromium-based browsers enforce Trusted Types; browsers without support ignore the directives, and the page still works.

## Common mistakes

- **A library writes `innerHTML`.** Some third-party libraries write HTML strings. They fail with Trusted Types. Look for a Trusted Types option in the library, or give it its own policy.
- **Forgetting the policy name.** A policy that is not listed in `trusted-types` cannot be created; `createPolicy` throws.

## See also

- [Content Security Policy](csp.md)
- [Refs](../components/refs.md)
- [Browser-only code](../components/browser-only.md)
