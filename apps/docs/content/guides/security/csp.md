---
title: Content Security Policy
description: Rivet sends a strict Content Security Policy by default. Learn what it allows, how static sites get one, and how to change or turn it off.
template: guide
status: experimental
related: [guides/security/trusted-types, guides/security/server-only-code, guides/deploy/node, guides/deploy/static-hosts]
---

A :term[Content Security Policy]{id=content-security-policy} (CSP) tells the browser which scripts may run on a page. If an attacker manages to inject a `<script>` tag into your HTML, a strict CSP stops it from running. Rivet apps get a strict policy without extra setup, both on a Node server and on static hosts.

After reading this page you know what policy Rivet sends, how it works with resuming, and how to change it.

## Server pages: a nonce policy

With the Node adapter (`start()` or the dev server), every HTML page gets this header:

```txt
Content-Security-Policy: script-src 'nonce-<random>' 'strict-dynamic'; object-src 'none'; base-uri 'none'
```

What it means:

- **`'nonce-<random>'`**: a nonce is a random value, new for every response. Only `<script>` tags that carry this value run. Rivet adds it to its own inline scripts (the resume loader). Injected scripts do not know the value, so they are blocked.
- **`'strict-dynamic'`**: scripts that a trusted script loads are trusted too. This lets the loader import your [chunks](../performance/chunks.md).
- **`object-src 'none'`**: no plugins (`<object>`, `<embed>`).
- **`base-uri 'none'`**: no `<base>` tag that could redirect relative URLs.

The page state script (`<script type="rivet/boundaries">`) is data, not code, so it needs no nonce. JSON data responses for client navigation get no CSP header; they are not pages.

The Node adapter creates the nonce. If you write your own handler with `serve()`, the handler receives it as `context.nonce`:

```ts
import { serve } from "@rivetjs/router/node";

await serve({
  handler: async (request, { nonce }) =>
    new Response(`<!doctype html><script nonce="${nonce}">console.log("allowed")</script>`, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`,
      },
    }),
});
```

The policy string comes from `strictCSP(nonce)` in `@rivetjs/router/server`.

::api{symbol="@rivetjs/router/server#strictCSP"}

## Static pages: a hash policy

Static files have no per-request nonce. Instead, `prerenderBuild` adds a `<meta>` tag to each page that has inline scripts (with `directives` set, to every page). A page without scripts gets no tag; it runs no code a policy could block. It allows the page's own inline scripts by their SHA-256 hash, and script files from your own origin:

```html
<meta http-equiv="Content-Security-Policy" content="script-src 'sha256-…' 'self'; object-src 'none'; base-uri 'none'">
```

This uses `'self'` instead of `'strict-dynamic'`. Browsers pass a nonce's trust on to `import()`, but not a hash's, and the loader imports its chunks. So chunk files must come from the same origin as the page.

The policy is on by default. Options of `prerenderBuild`:

```js title="prerender.js"
import { prerenderBuild } from "@rivetjs/router/static";

// Default: hash policy in a <meta> tag.
await prerenderBuild({ dist: "dist" });

// Also enforce Trusted Types.
await prerenderBuild({ dist: "dist", csp: { trustedTypes: true } });

// No <meta> tag: your host sends the CSP header.
await prerenderBuild({ dist: "dist", csp: false });
```

`hashCSP(html, options)` from `@rivetjs/router/static` does the same for any HTML string.

## Add sources and directives

Some libraries need more than scripts from your origin. WebAssembly needs `'wasm-unsafe-eval'`, a worker built from a `blob:` URL needs `worker-src`, and a fetch request to another service needs `connect-src` (a native form submission uses `form-action`). Pass them as `directives`:

```js title="prerender.js"
await prerenderBuild({
  dist: "dist",
  csp: {
    directives: {
      "script-src": "'wasm-unsafe-eval'",
      "worker-src": ["'self'", "blob:"],
      "connect-src": "'self' https://api.example.com",
    },
  },
});
```

- `script-src` sources are added to the generated ones (hashes and `'self'`, or the nonce and `'strict-dynamic'` on a server). `object-src` and `base-uri` replace the generated `'none'`. Other directives are added as given.
- The same option works for server pages: `start({ csp: { directives } })`, `createApp({ csp: { directives } })` or `strictCSP(nonce, { directives })`.
- Unknown directive names, and sources with `;`, `,` or quotes in the wrong place, throw when the build or server starts. Turn on Trusted Types with `trustedTypes`, not with `directives`.
- Nothing is added for you. `'unsafe-inline'` only appears if you write it.
- A `<meta>` policy cannot carry `frame-ancestors`, `report-uri`, `report-to` or `sandbox`; browsers ignore them there, so static pages throw for them. Send those as a header from your host.
- On server pages, `'strict-dynamic'` makes browsers ignore host sources such as `https://cdn.example.com` in `script-src`. Keywords like `'wasm-unsafe-eval'` still apply.

::api{symbol="@rivetjs/router/static#hashCSP"}

## Add your own scripts

Inline scripts you write in the document shell must carry the nonce. The shell receives it:

```ts title="src/document.ts"
import { headTags, type DocumentShell } from "@rivetjs/router/server";

const document: DocumentShell = (input) => ({
  start:
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    headTags(input.head, input) +
    `<script nonce="${input.nonce ?? ""}">document.documentElement.dataset.js = "on"</script>` +
    "</head><body>",
  end: "</body></html>",
});
export default document;
```

On static pages, `prerenderBuild` hashes every inline script it finds, including yours.

Third-party scripts from another origin (analytics, chat widgets) are blocked unless a trusted script loads them. Load them from your code, for example with `import()` inside a `clientEffect`; `'strict-dynamic'` then allows them on server pages. On static pages, `'self'` allows only your origin, so host the script yourself or set your own policy.

## Change or turn off the policy

- A route can set its own `Content-Security-Policy` header with a `headers(…)` export in its page file. That header replaces the default for that route. It does not receive the nonce, so it must allow Rivet's inline loader another way.
- `createApp({ csp })` from `@rivetjs/router/server` accepts a function `(nonce) => policy`, or `false` for no header.
- `start()` from `@rivetjs/router/node` takes the same `csp` option: `{ trustedTypes, directives }`, a function or `false`.

The policy only covers scripts. It sets no `style-src` or `img-src`. If you add those directives (with `directives`), remember that `Picture` uses an inline `style` attribute for its placeholder. Rivet's own `<style>` elements (small [inlined stylesheets](../styling/css-and-tailwind.md#small-stylesheets-are-inlined), head styles) stay allowed: Rivet adds the page's nonce (server pages) or their hashes (static pages) to the `style-src` / `style-src-elem` you set. A list with `'unsafe-inline'` is left as you wrote it, because a nonce or hash would turn `'unsafe-inline'` off. With only a `default-src` (no `style-src`), Rivet adds a `style-src` with the `default-src` sources plus the nonce or hashes, so the browser does not fall back to a `default-src` that blocks the page's own `<style>` elements.

A static host that sends headers (Netlify and Cloudflare `_headers`, Vercel `vercel.json` `headers`) can send the policy for every file, also for pages without scripts. Header-only directives such as `frame-ancestors` work only there, not in the `<meta>` tag. Then build with `csp: false` and copy the policy into the host's header config.

## Common mistakes

- **Inline `onclick="…"` attributes in raw HTML.** They are blocked. Use JSX event handlers; they do not need inline code.
- **Testing the policy in the dev server only.** The dev server sends the nonce policy too, but static pages get their hash policy only from `prerenderBuild`. Check the built site.
- **Serving chunks from a CDN on a static site.** With the hash policy, chunk files must come from the page's origin.

## See also

- [Trusted Types](trusted-types.md)
- [Server-only code](server-only-code.md)
- [Node](../deploy/node.md)
- [Static hosts](../deploy/static-hosts.md)
