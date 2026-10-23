# @rivetjs/forms

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Type-safe, resumable, progressively enhanced forms over Standard Schema v1 (Zod, Valibot, ArkType, hand-written). No schema-library or i18n dependency.

## Entry points (`package.json` exports)

- `.` → `index.ts` (re-exports only); `development` condition → `dev.ts` (same exports; `createForm` reports stores to DevTools `lib.form`).
- `./components` → `components.tsx`: `FieldError`, `ErrorSummary`, `FormMeta`, `FormStatus`.
- `./scope` → `scope.ts`: `scope(form, path)` typed sub-form view, `scopePath`.
- `./array` → `array.ts`: `keys`, `rows`, `insert/remove/move/swap/replace`, `*Intent` builders, `isArrayIntent`.
- `./wizard` → `wizard.ts`: `defineWizard`, `createWizard`, step nav, `stepFromUrl`/`stepHref`, `DraftStore` types.
- `./autosave` → `autosave.ts`; `development` → `autosave-dev.ts` (DevTools `lib.autosave`).
- `./errors` → `errors.ts`: `mapIssues`, `fromPointer`, `fromBracketPath`, `issueRecord`.
- `./server` → `server/index.ts` (server only; `browser` condition → `server/browser.ts` throws). See `server/CLAUDE.md`.
- `./csrf` → `csrf.ts` (server only; `browser` → `server/browser.ts`): `csrfToken`, `verifyCsrf`.

## Layout

Flat: one file per module at package root, `server/` for server-only code (package convention; keep it — `apps/docs/src/generated/api.json` and `docs/guides/devtools.md` cite these paths).

- Public: `index.ts`, `dev.ts`, `components.tsx`, `scope.ts`, `array.ts`, `wizard.ts`, `autosave.ts`, `autosave-dev.ts`, `errors.ts`, `csrf.ts`.
- Core internals (re-exported by `index.ts` where public):
  - `define.ts` — `defineForm` (module-scope definition: schema, coercion, timing, field checks).
  - `store.ts` — `createForm`, store shape (signals + literals, lazy per-field signal maps), status bits, `storeOf`/`prefixOf`.
  - `reads.ts` — binding reads + ids (`fieldId`, `describedBy`, `defaultValue`, …).
  - `handlers.ts` — delegated `onInput`/`onChange`/`onBlur`/`onSubmit`/`onInvalid` (`onInvalidCapture`: native validation stopped a submit before any handler ran → `noValidate`, report via shared `attempt()`, no submit; G14, `app.test.ts` contact).
  - `engine.ts` — schema runs, issue writes for armed fields, timing, debounced abortable field checks.
  - `mutate.ts` (`setValue`, `setIssues`, `clearIssues`, `reset`), `validate.ts` (imperative `validate`).
  - `dom.ts` — form element/FormData access (DOM owns values); public `focusFirstInvalid(form, element?)`, internal `focusInvalid(store, element)`.
  - `enhance.ts` + `transport.ts` — enhanced fetch submit, JSON answer (`ActionAnswer` type from `@rivetjs/router`, the handler's wire type, decoded with runtime `_decodeWire` — async: loads the built-ins chunk `x` first when the answer holds RegExp / URLSearchParams / binary / error entries; autosave `postDraft` decodes the same), `follow(to, answer?)` redirect (PRG back to the shown URL: `invalidate(answer data)` when the server sent it, else `invalidate()`). Router access: `router.ts` (FOLD 2026-10-12) — never imports `@rivetjs/router/client` (type-only `FreshData`): the router brand `globalThis[Symbol.for("rivet.router")]` (`clear`, `go`; router `client/index.ts` `_brand`, installed by the generated App handlers of forms apps — router codegen `forms`, detected from `@rivetjs/forms` or ui `Form`); before `go` exists: one `rivet:go` ask (client-rendered / booted App answers at once), else boot the resume loader, ask again on `rivet:attach`, resolve on `rivet:router`, ONE 10 s timeout; no `[data-rivet-go]` / timeout / other origin → `location.assign` / `location.reload` (a full GET: client state lost; forms guide says so); non-HTTP(S) redirect → TypeError (network issue). Tests `tests/router.test.ts`. Keeps the router client in the App chunk (story app 10 → 7 chunks before interaction). Headers: `accept: application/json` (+ `x-rivet-revalidate`) only — no form-id header (the id rides in `_form`). Lazy (`import()`).
  - `submit.ts` — custom transport (`defineForm({ submit })`): `enhance.ts#send` hands over to it (lazy, via enhance so `reset`/`mutate` stays in the enhance chunk; no extra chunk for plain forms). Submitting bit, abort on resubmit, `{ ok: false, issues, form }` → issues + focus, throw → `errors.submit`, else `lastResult` + reset.
  - `decode.ts` (FormData → schema input, limits, `META_FIELDS`), `path.ts` (dotted/bracket paths, prototype-pollution hardening), `issues.ts`, `types.ts` (type-level `FieldPath`/`PathValue`), `standard-schema.ts` (vendored Standard Schema v1 types, MIT).
- `server/` — actions, wizard/draft endpoints, no-JS intents (own CLAUDE.md).
- `tests/` — vitest project `forms` (`libs/forms/tests/*.test.ts`); `fixtures.ts` shared helpers.
  - `tests/drawer-app/` — live page (`export const live = true`) with a customer list + "New customer" form in a cdk `Modal` drawer (layout loader total, page-local counter, `?new` / failed POST open it without JS, `onSubmit` → close on `true`); `serve.ts` (PORT 4641), `measure.ts` (bytes / DOM mutations / state per submit, JSON; spec numbers); `/overlays` (not live: cdk Modal, cdk Popover, ui Drawer, ui Sheet, each with an `invalidate()` button + a `Link` to `/other`) for the overlay-leak regression. e2e `drawer.test.ts` (drawer flows + per overlay kind: non-live revalidation, client navigation away, back button → no portal / `inert` / scroll lock left).
  - Resume: derived model (M6-PARITY moved forms onto it; the only model since M6-CUT 2026-10-22): "no form code before interaction" = only `data-fo` modulepreloads, no handler ran; the SSR button has no `data-r`. Progressive enhancement, enhanced submit, revalidation, drawers, wizard, autosave: same results as on the old serialized model.
  - `tests/app/` — runnable demo (file routes, resumed: signup, wizard, field array, notes, order, draft/autosave, contact = custom submit to an external endpoint, `ui-signup` = `@rivetjs/ui` `Form form definition` + named TextFields on the signup definition). `serve.ts` builds + serves it; used by `app.test.ts` (Chromium via playwright). `dist/`, `.rivet/` gitignored.

## Rules / invariants

- `sideEffects: false`, `index.ts` re-exports only: an app pays only for imported functions.
- Definitions are module-scope and never serialized; handlers/actions take the definition explicitly (`onInput(def, form, e)`) so the resumed browser reaches it via module imports.
- Store stays small: per-field signals created on first use only; field values live in the DOM, not the store.
- Reads subscribe to the fewest signals (field binding → that field's record only); `dev.ts` describers read untracked and never create lazy signals.
- Lazy chunks: `enhance.ts`/`transport.ts` load on first valid submit / remote check (`submit.ts` after `enhance.ts` when `def.submit`), `array.ts` on array intents, resume-format decoder in autosave on demand. Don't add static imports of them from `handlers.ts`/`engine.ts`.
- Client and server decode the same way (`decode.ts` used by both) → identical validation input.
- Dev façades (`dev.ts`, `autosave-dev.ts`) must keep the exact export surface of their base module (`export *` + override).
- Server-only code (`server/*`, `csrf.ts`) must never join a client graph (`browser` condition throws). Apps import it from `*.server.ts`.
- Messages are issue keys or literal messages; i18n via a `format` callback, never an i18n import.
- Components: reads stay inside JSX expressions (component bodies run once).

## Commands

```sh
export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH
npx vitest run --project forms        # = NX_DAEMON=false npx nx run forms:test --output-style=static --skip-nx-cache
node scripts/tsc.ts -p libs/forms     # = nx run forms:typecheck (tsgo)
node libs/forms/tests/app/serve.ts [--dev]   # demo on PORT (default 4321)
```
- Publishable package: `NX_DAEMON=false npx nx run forms:package` → `dist/libs/forms` (`.ts` → `.js`, `.tsx` → `.jsx`, `.d.ts`, LICENSE, generated package.json); publish from there — this package.json stays the private workspace manifest (`publishConfig.directory`). Builder + tarball smoke: `scripts/package/` (scripts/CLAUDE.md). `components.tsx` ships as preserved-JSX `components.jsx` (compiled by the app's Rivet Vite plugin).

## Gotchas

- No automatic per-render form ids: one definition rendered twice needs `id` + `<FormMeta>`.
- No "Error:" title prefix on failed no-JS posts (heads run without the action result).
- Array rows: `name` follows the index, `defaultValue` follows the row key (server rows keyed by index).
- Successful enhanced submit revalidates the page from the answer's route data (single flight, awaited before `onSubmit` resolves); `defineForm({ revalidate: false })` opts out; prefetched route data is dropped on submit. A live page (router `export const live = true`) updates in place instead of re-rendering (overlay / page state kept).
- `onSubmit` → `Promise<boolean> | undefined` (`send` / `submit.ts` too): `true` = server accepted + page fresh / redirect served; `false` = issues, failures, aborts, array intents, `enhance: false`. A redirect to the shown URL revalidates (`transport.ts` `follow`; `navigate()` to it is a no-op).
- `createForm({ result })` applies an action result only when the action key equals `def.name` (`?/customer` for `name: "customer"`).
- `defineForm({ submit })` runs only in the browser after a valid enhanced submit (`enhance: false` → native POST, `submit` unused); no JS → native POST to the form's `action` (point it at the same endpoint). Not called by `action()`. Demo: `tests/app/src/routes/contact.tsx` (external endpoint mocked in `app.test.ts`).
- Tests import router internals by path (`../../router/server/handler.ts`).

## See also

- `../../docs/guides/forms.md` (dense reference), `../../docs/design/specs/2026-10-03-forms-design.md`, `../../docs/design/plans/2026-10-03-forms.md`
- `../../docs/guides/routing.md` (revalidation, `beforeLeave`, CSRF), `../../docs/guides/devtools.md` (Forms pane hooks)
- User guide: `../../apps/docs/content/guides/forms/forms.md`; example `../../apps/docs/examples/contact-form/`
- `server/CLAUDE.md`
