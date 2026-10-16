# i18n under an app base path

Found while adding the docs example `i18n-plurals` (docs examples are built under `/<id>/`).

## Problem

- Locale client builds set Vite `base` to `<base><locale>/` (assets). The router took that as the app base: route patterns `/<base>/uk/:lang`, `BASE` = `/<base>/uk` (client `<Link>`/`navigate()` wrong in non-default locales; server renders `/<base>`).
- `rivetRouter({ base })` overwrote the i18n locale suffix (assets of every locale at one base).
- `localizeHref` / `delocalizeHref` / the `url` strategy read the first path segment as the locale; under a base that is the base. `localizeHref("/shop", "de")` was `/de/shop`; guard redirects and `alternates()` broke the same way.

## Decisions

- Router owns the app base. In an i18n locale client build (plugin `vite-plugin-rivet-i18n` with `api.locale`, `command: build`, not SSR) it strips the `/<locale>` suffix from Vite's base for codegen, keeps the suffix on Vite's base (also with `rivetRouter({ base })`).
- `BASE` in those builds: the router's `transform` inlines the app base into its own `shared/base.ts` (matched by absolute path). Rejected: `define` of `import.meta.env.RIVET_BASE` + `??` fallback in `base.ts`: +16 B in every router app (zero-cost rule). Rejected: redefining `BASE_URL`: breaks `public/` URLs, which are per locale.
- i18n helpers: `localizeHref(href, locale, config, base = BASE)`, `delocalizeHref(href, config, base = BASE)`; the locale prefix follows the base; paths outside the base behave as before. Same default-parameter shape as the router's `withBase(to, base = BASE)`. The `url` strategy strips `BASE` too.
- Comparison: SvelteKit (`paths.base` + `$app/paths`), Next (`basePath` + `i18n` with locale after `basePath`), Remix (`basename`): all put the locale after the base. Same here.

## Limits

- Dev with a base and a non-default locale: unchanged (dev entry query, no base suffix).
