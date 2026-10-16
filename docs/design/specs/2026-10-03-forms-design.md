# Forms: `@rivetjs/forms` (design)

Date: 2026-10-03. Status: draft design, not implemented. Package `@rivetjs/forms` (`libs/forms`). Builds on `@rivetjs/reactivity` (signals), resume ([resumability design](2026-10-03-resumability-design.md), [docs/guides/resumability.md](../../guides/resumability.md)), `@rivetjs/router` actions ([router design](2026-10-03-router-design.md), `libs/router/server/handler.ts`), [i18n design](2026-10-03-i18n-design.md). Coordinates with (not yet written) server-markers spec (`2026-10-03-slots-and-server-markers-design.md`) and cdk/aria spec (`2026-10-03-cdk-and-aria-design.md`).

## Goal
- Type-safe, modular forms: pay per imported function; typed field paths (nested, arrays), typed values/issues.
- Validation via [Standard Schema](https://standardschema.dev) (Valibot, Zod, ArkType — no adapter packages); sync + async; timing modes; cross-field rules.
- Fine-grained signal state per field (value, touched, dirty, issues) + form state (submitting, submitted, submit count); no component re-runs (Rivet never re-runs components anyway; only bound text/attrs update).
- Resumable: server-rendered form = plain HTML, zero JS until first interaction; handler chunk loads on intent.
- Progressive enhancement: `<form method="post" action="?/name">` works with JS disabled (full round trip, errors, focus); enhanced fetch submit once resumed.
- Router server actions: validation-error / redirect / error round trip, CSRF, file uploads, route-data revalidation in the same response.
- Accessible by default: `aria-invalid`, `aria-describedby` error linking, focus first invalid (JS and no-JS), error summary.
- Zero cost: apps not importing forms → compiler output byte-identical, ssr-bench HTML/req/s unchanged.

## Non-goals (v1)
- Generic form builder / JSON-schema-driven UI generation.
- UI components (inputs, selects, date pickers) — cdk/aria library's job; forms gives ids/attrs/state.
- Schema introspection (deriving `required`/`minlength` from Zod/Valibot) — Standard Schema has none; later adapter (open question 6).
- Optimistic UI helpers, offline queueing, multi-step wizard persistence.
- Streaming multipart parsing / direct-to-storage uploads (v1: `request.formData()`, in-memory, size-capped).
- Controlled third-party widgets with non-DOM values (rich text, maps) beyond `setValue()` API.
- Rate limiting / captcha.

## Prior art: lessons applied
| Library | Take | Avoid |
|---|---|---|
| Modular Forms (Qwik/Solid) | free functions on a data store (`getValue(form, 'x')`, `insert(form, …)`) → tree-shakable, store serializable for Qwik resume; dotted typed paths; `validateOn`/`revalidateOn` | `<Field>` render-prop components (render props = non-serializable captures in Rivet resume); Qwik `routeAction$` coupling |
| Angular reactive / signal forms | field tree mirrors model; typed `FormControl<T>`; validators as data; status signals | class instances (unserializable), eager tree of controls for every leaf |
| TanStack Form | headless, typed deep paths, field-level async validators with debounce + abort, `onChange`/`onBlur`/`onSubmit` validator slots | subscription selectors (unneeded with signals), large core |
| React Hook Form | DOM as source of truth (uncontrolled inputs, `register` by `name`), `mode`/`reValidateMode` defaults, `shouldFocusError` | re-render-avoidance machinery; ref registration needs component execution |
| Conform | progressive enhancement first: server `parseWithZod(formData)`, reply → issues + echoed values, intent buttons for array ops without JS, form id for multi-form pages, constraint attributes | Zod/Valibot-specific introspection in core |
| SvelteKit form actions | `?/name` actions, `fail(400, data)`, `use:enhance` fetch submit, re-run loaders after action, 303 after POST, Origin CSRF check | invalidate-all second request (Rivet returns data in the action response) |
| Remix / SolidStart | single-flight mutation (action response carries revalidated loader data) | — |
| GOV.UK design system | error summary (`role=alert`, links to fields), `autofocus` first error without JS | — |

## Architecture (one picture)
- Definition (module scope, never serialized): `defineForm({ schema, … })` → holds schema, validators, coercion, messages. Imported by handlers + server action (module refs, not captures).
- Store (per component instance, serialized when captured): `createForm(def, …)` → plain object of signals + literals. No functions, no class instances → passes resume format.
- DOM: inputs are native, identified by `name` = typed field path. Values live in the DOM until interaction; store reads them on activation.
- Wiring: three delegated handlers on `<form>` (`input`/`change`, `focusout`, `submit`) — one small symbol chunk regardless of field count. Bound attrs/text (`aria-invalid`, error text) are resumable bindings on store signals.
- Server: `action(def, fn)` parses `FormData` → schema → `fn(values, event)`; returns `ok` / `invalid(issues)` / `redirect`; router renders page (no JS) or answers JSON (enhanced).

## API (examples)

### Definition (`signup.form.ts`, universal; module scope)
```ts
import { defineForm } from "@rivetjs/forms";
import * as v from "valibot";

export const signupForm = defineForm({
  name: "signup",                       // action name + form id prefix; must match `?/signup`
  schema: v.pipe(
    v.object({
      email: v.pipe(v.string(), v.email("errors.email")),           // messages = i18n keys
      password: v.pipe(v.string(), v.minLength(8, "errors.min8")),
      confirm: v.string(),
      age: v.optional(v.pipe(v.number(), v.minValue(18, "errors.adult"))),
      address: v.object({ city: v.string(), zip: v.string() }),
      tags: v.array(v.string()),
      items: v.array(v.object({ sku: v.string(), qty: v.number() })),
      avatar: v.optional(v.file()),
    }),
    v.forward(v.check((i) => i.password === i.confirm, "errors.mismatch"), ["confirm"]), // cross-field
  ),
  coerce: { age: "number", tags: "array", "items.$.qty": "number", avatar: "file" }, // FormData → typed input
  validateOn: "blur",        // first validation: "submit" (default) | "blur" | "input" | "change"
  revalidateOn: "input",     // after a field shows an issue / after submit: "input" (default) | "blur" | "submit"
  fields: {                  // optional field-level validators (async, debounced, abortable)
    email: { validate: async (email, { signal }) => (await available(email, signal)) ? undefined : "errors.taken", debounce: 300 },
  },
  echo: { exclude: ["password", "confirm", "avatar"] }, // never echoed back after a failed POST (default: password/file inputs)
});
export type SignupInput = InferInput<typeof signupForm>;   // typed values
```

### Page (`routes/signup.tsx`)
```tsx
import { createForm, formId, submitting, onInput, onBlur, onSubmit, isInvalid, describedBy, fieldId } from "@rivetjs/forms";
import { FieldError, ErrorSummary, FormMeta } from "@rivetjs/forms/components";
import { signupForm } from "../signup.form.ts";

export default function Signup({ data, action }: PageProps<Data, {}, Actions>) {
  const form = createForm(signupForm, { initial: data.defaults, result: action }); // store: signals only
  return (
    <form method="post" action="?/signup" id={formId(form)} aria-busy={submitting(form)}
      onInput={(e) => onInput(signupForm, form, e)}
      onFocusOut={(e) => onBlur(signupForm, form, e)}
      onSubmit={(e) => onSubmit(signupForm, form, e)}>
      <FormMeta of={form} /><ErrorSummary of={form} />
      <label for={fieldId(form, "email")}>Email</label>
      <input id={fieldId(form, "email")} name="email" type="email" required
        value={data.defaults.email}                                      // server value; DOM owns it afterwards
        aria-invalid={isInvalid(form, "email")} aria-describedby={describedBy(form, "email")} />
      <FieldError of={form} name="email" />
      <input name="address.city" … />                                    // typed: FieldPath<SignupInput>
      <button>Sign up</button>
    </form>
  );
}
```
- Handlers inline in app JSX → compiler extracts them; `signupForm` is a module import (no capture); `form` capture = signals/literals → serializable. `onInput(...)` etc. are plain imported functions (tree-shaken by use).
- Bindings `isInvalid(form, "email")` / `describedBy(...)` are calls → resumable attribute bindings; signals read = field issue signal only.
- Typos in `name`/path args: TS error via `FieldPath<T>`; `name` attribute checked by an optional TS plugin/lint later (open question 7).

### Field arrays (`@rivetjs/forms/array`)
```tsx
<For each={keys(form, "items")} by={(k) => k}>{(k, i) => (
  <fieldset>
    <input name={`items.${i()}.sku`} />                                  // reactive name: reindexes on move/remove
    <button type="submit" name="_intent" value={`remove:items.${i()}`}
      onClick={(e) => remove(signupForm, form, "items", i(), e)}>Remove</button>
  </fieldset>)}
</For>
<button type="submit" name="_intent" value="insert:items" onClick={(e) => insert(signupForm, form, "items", {}, e)}>Add</button>
```
- No JS: intent buttons submit; server applies `insert/remove/move` to echoed values, skips the user action, re-renders (Conform model). JS: handler `preventDefault`s, mutates `keys` signal → `For` creates/removes rows (DOM templates; creation allowed).

### Server (`routes/signup.server.ts`; file convention may change per server-markers spec)
```ts
import { action, invalid } from "@rivetjs/forms/server";
import { redirect } from "@rivetjs/router";
import { signupForm } from "../signup.form.ts";

export const actions = {
  signup: action(signupForm, async (values, event) => {        // values: InferOutput, schema-parsed
    if (await users.exists(values.email)) return invalid({ email: "errors.taken" });
    await users.create(values, event.signal);
    return redirect("/welcome", 303);
  }),
};
```
- `action(def, fn, { maxBytes?, revalidate? })` → plain router action `(event) => result`; convention-agnostic (works under `actions` export, a `server$`-style marker, or whatever the server-markers spec picks — it only needs "a named POST handler for this route").

### Function inventory (each its own module)
- Store: `createForm`, `formId`, `reset`, `setValue`, `setIssues`, `clearIssues`, `validate` (imperative, returns typed result).
- Reads (bindings): `value`, `issues`, `issue`, `isInvalid`, `touched`, `dirty`, `submitting`, `submitted`, `submitCount`, `formIssues`, `validating`.
- A11y ids: `fieldId`, `errorId`, `descriptionId`, `describedBy`.
- Handlers: `onInput`, `onBlur`, `onSubmit` (+ `onChange` alias for selects/checkboxes handled by `onInput`).
- Arrays: `keys`, `insert`, `remove`, `move`, `swap`, `replace`.
- Components: `FieldError`, `ErrorSummary` (no handlers; resumable bindings only).
- Server: `action`, `invalid`, `decodeFormData`, `parse` (standalone), `safeRedirect`.

## Types
- `FieldPath<T>`: dotted template-literal union — `"email" | "address.city" | \`items.${number}.qty\`` (depth cap 8, arrays as `${number}`); `FieldArrayPath<T>` for array-typed paths; `PathValue<T, P>`.
- `InferInput<Def>` / `InferOutput<Def>` from `StandardSchemaV1.InferInput/Output`.
- `Issue = { key: string; params?: Record<string, string | number>; message?: string }` — `key` = i18n message key or literal message; locale-agnostic (serializable, cacheable).
- Action typing: router codegen adds `actions` return types to `.rivet/routes.d.ts`; `PageProps<D, P, A>` gets `action?: ActionResult<A>`; `createForm(def, { result })` narrows by `def.name`.
- Compile-time cost guard: path type computation lazy per used path (`P extends FieldPath<T>` constrained generic), benchmarked with tsc on a 200-field schema (< 50 ms added check time).

## State model
- Store (`FormStore<T>`), all serializable:
  - `i`: form id (`def.name` + per-render ordinal when the same def renders twice).
  - `st`: `Signal<number>` status bits — submitting, submitted, validating, enhanced.
  - `n`: `Signal<number>` submit count.
  - `fe`: `Signal<Issue[]>` form-level issues (non-field schema issues, action errors, 4xx/5xx messages).
  - `f`: `Record<path, FieldRecord>` lazily created on first read (server render or client).
  - `FieldRecord = { e: Signal<Issue[] | undefined>, t: Signal<boolean>, v?: Signal<unknown> }` — `v` only created when something reads `value(form, path)` (a bound preview, `dirty` binding) or the app calls `setValue`.
  - `k`: `Record<arrayPath, Signal<string[]>>` field-array keys (stable row keys; needed by `For` adoption).
  - `x`: echoed values from a failed POST (only when `result` present; excludes `echo.exclude`).
- Not stored / not serialized: schema, validators, coercion map (definition, module scope); field values (DOM is source of truth); initial values (DOM `defaultValue`/`defaultChecked`/`defaultSelected` = initial → `dirty` computed from DOM, no state).
- `dirty(form, path)`: `v` vs element default; form `dirty`: any field record dirty or DOM scan (lazy, on read).
- Activation on client: first handler call reads `form.elements` once into value signals only for fields with records; others read on demand (`readValue(el)` handles text, number (`valueAsNumber`), checkbox (group → array), radio, select-multiple, file → `FileList`).
- Fine-grained updates: one field's issue change notifies only that field's `e` signal → only its `aria-invalid`/error text bindings run. Form-wide computeds (`isInvalid(form)`, `formIssues`) are computeds with equality cut-off.
- `setValue(def, form, path, v)` writes DOM element value + signal (for custom widgets); `reset` restores DOM defaults (`form.reset()`) and clears records.
- Serialization size (target): form with 10 fields, none bound to value → state ≈ store object + 2 signals per bound field ≈ < 400 B JSON; asserted in tests.
- Encoder timing risk: handler captures on `<form>` are recorded before child fields render; field records created later must still be in the encoded store. Plan step 1 verifies the encoder interns captured objects at page end (or by reference, finalized at state-script write); fallback: `createForm` pre-creates records for paths in `initial`/`result`/`fields` and bindings created after the capture register into the store via the recorder's object identity (no copy).

## Validation
- Engine: whole-schema `schema["~standard"].validate(input)` (sync or Promise); issues mapped by `issue.path` (keys / `{ key }` segments) → dotted path; root issues → `fe`.
- Input building: `decode` from DOM (`new FormData(formEl)` + `coerce` map) — same function as the server's `decodeFormData` → client and server see identical input.
- Coercion (`coerce` map; `$` = any array index): `number` (empty → undefined, `NaN` → keeps string so schema fails), `boolean` (`"on"`/`"true"`), `array` (repeated keys; single key → `[x]`; absent → `[]`), `file` (empty file → undefined), `date` (`valueAsDate` semantics), `json`. Unlisted: string; empty string → undefined (Conform rule) unless `emptyAs: "string"`.
- Timing (RHF/Modular Forms model):
  - `validateOn`: when a pristine field is first validated — `submit` (default), `blur`, `change`, `input`.
  - `revalidateOn`: after a field has an issue shown or after first submit — `input` (default), `blur`, `submit`.
  - Submit always validates everything; shows all issues.
- Which issues show: only for paths that are touched (blurred) or after submit; others computed but not written (no "error while typing first char").
- Cross-field: schema-level (`v.forward(v.check…)`, Zod `superRefine({ path })`, ArkType `narrow` + path); because every trigger validates the whole schema, dependents revalidate automatically — issue writes are filtered to shown paths, so `confirm` updates when `password` changes once `confirm` is touched. Optional `deps: { confirm: ["password"] }` to mark dependents touched-eligible.
- Field-level validators (`fields.<path>.validate`): sync or async; `(value, { signal, values })`; `debounce` ms; `AbortController` per field (new input aborts in-flight); `validating` bit; submit awaits pending field validators (timeout `asyncTimeout`, default 10 s → form issue `errors.timeout`). Run only on client by default; `server: true` re-runs inside `action()`.
- Schema code size: schema module joins the handler chunk (loaded on intent). `clientValidation: false` → handlers skip schema (not imported into client graph: def split via `defineForm` + `defineServerSchema` — open question 4) → zero schema bytes; enhanced submit + server issues only.
- Native constraints: author-written `required`, `type=email`, `minlength` work with zero JS. On activation (`enhanced` bit set by first handler run) the store sets `formEl.noValidate = true` so library messages + focus take over; before activation native bubbles show (acceptable; consistent with no-JS).

## Server actions & router integration
- Router today (`libs/router/server/handler.ts`): `POST ?/name` → Origin / Sec-Fetch-Site check → guards → `actions[name]` → re-run loaders → render, or JSON `{ action }` on `Accept: application/json`; `RenderInput.action` exists but pages don't receive it. Required router changes (small, pay-per-use, all inside the action branch):
  1. Pass `action` to pages: `ServerRouteData.action` + `PageProps.action` (value), serialized only if the page captures/reads it (most pages read it once in `createForm` on the server → only the store's derived signals serialize).
  2. Action status: `invalid()` result → status 400 (configurable 422); `HttpError` 4xx from action → form-level issue, not `_error` page, when the request is enhanced (`accept: application/json`) or the action is a forms action (no-JS: render page with status + `fe`).
  3. POST redirect default 303 (`redirect()` in actions without explicit status → 303).
  4. Single-flight revalidation: JSON action response `{ action, status, data?, head?, redirect? }` — `data` = re-run loaders (same encoding as data endpoint) unless `revalidate: false` or result `invalid` (failed validation changes no server state → loaders skipped, saves work).
  5. Body limits: `maxBodySize` per action (default 1 MiB urlencoded, 10 MiB multipart) enforced by streaming count before `formData()`; 413 on overflow.
  6. Layout actions (optional): `?/layout:name` targets a layout's `actions` (e.g. logout in root layout). v1: page actions only (current behaviour).
  7. Static adapter: route with `actions` → build error (needs server); CSR adapter: same.
- `action(def, fn)` pipeline: `content-type` check (urlencoded | multipart) → `request.formData()` → `_intent` handling (array ops / `validate:<path>` → returns echo + issues, no `fn`) → `decodeFormData(fd, def.coerce)` → `def.schema` validate → `fields.*.validate` with `server: true` → `fn(output, event)`.
  - Result shapes (wire, resume-format encoded): `{ ok: true, data? }` | `{ ok: false, issues: Record<path, Issue[]>, form?: Issue[], values?: echoed }` | redirect (HttpError) | `Response` passthrough.
  - Echo: submitted values minus excluded fields (passwords, files) so the no-JS re-render keeps user input.
  - Form id: `<FormMeta of={form} />` renders `<input type="hidden" name="_form">` (+ `_csrf` in token mode); result applied only to the matching instance when a page has several forms of the same def. Single-form pages may omit it (match by `def.name`).
- No JS round trip: POST → action → (redirect 303 → GET) | (invalid → 400 page render with store hydrated from `result`: issues on fields, `submitted` bit, echoed values as input `value`s, `autofocus` on first invalid, `ErrorSummary` filled).
- Enhanced round trip (resumed):
  1. `onSubmit` → `preventDefault` → client validate (if enabled) → invalid: write issues, focus first invalid, stop.
  2. `st.submitting` on; `fetch(form.action, { method: "POST", body: FormData (submitter included), headers: { accept: "application/json" }, signal })` — `enctype` respected; double-submit guarded (second submit aborts first unless `queue: true`).
  3. Response: `redirect` → router `navigate(to, { replace: false })` (same origin) else `location.assign`; `invalid` → write issues, focus; `ok` + `data` → router revalidate (below), `reset` unless `resetOnSuccess: false`; network / 5xx → `fe = [{ key: "errors.network" | message+digest }]`, form stays editable.
  4. `submitting` off; result also exposed as `lastResult(form)` signal for success messages.
- Router revalidation (client side, new `@rivetjs/router/client` export `revalidate(url, routeData)`): seeds the prefetch cache entry for the current URL with the returned data, then `router.navigate(url, { replace: true, scroll: false, focus: false })` → route region re-renders with fresh data (page chunk loads at that point if not yet). Root layout data signal updates in place. `settle()` must skip scroll/focus for revalidation (router change). Focus: if `document.activeElement.id` exists after re-render, re-focus it.
- Pages without a revived router: revalidate still works — router region revives on first `navigate` (existing design). If the app has no router (plain `renderResumable`), `revalidate: "reload"` → `location.reload()` fallback, or `enhance: false`.
- Dev mode (no resume, client-mounted pages): same handlers run as normal CSR code; same behaviour.

## Resumability / progressive enhancement
- Before interaction: zero JS beyond the existing loader (≤2 KB); no module request; form state script entries only for captured store + bound signals.
- Loader already covers: delegated capture listeners per type in `data-events` (`input` passive, `submit` non-passive, `focusout`); cold `submit` → cancel, load chunk, run handler, replay native submit unless prevented (our handler prevents → enhanced path). Cold `input` → handler runs after chunk load with the original event; value read from DOM, so no keystroke lost.
- Preload: submit/input handlers → `intent` (focusin on a field prefetches the forms chunk + schema); `form action` +2 impact already in scoring.
- What serializes: store object (ids, status, submit count, form issues), field records created during SSR (issue + touched signals; value signal only if bound), field-array keys, echoed values (only after a failed POST). Never: schema, validators, File objects, initial values.
- Activation cost: first handler reads DOM once; no component re-execution; schema module evaluated once.
- `FieldError`/`ErrorSummary` render server text inside resumable text/region bindings; client updates create new error DOM via templates (creation allowed).
- Streaming: forms inside `Async` stream normally (store lives in the streamed region's state patch).
- Without JS everything functional except async field validators (run server-side on submit if `server: true`) and live revalidation.

## i18n
- Issues carry keys, not localized strings → locale-agnostic serialized state; same issue in `de` and `en` builds.
- Rendering: `FieldError` default renders `issue.message ?? issue.key`; i18n apps render with prefix lookup: `<FieldError of={form} name="email">` uses a `format` prop given as a module-scope component, or app writes `{t(\`errors.${issue(form, "email")?.key}\`)}` (i18n `prefixLookup` → per-locale table in the client chunk; server: variant value in a JSX child slot).
- Params: `{ key: "errors.min", params: { min: 8 } }` → `t(…, params)`; ICU plural works.
- Server actions: `event.locals.locale` available; `invalid()` keys stay keys (no `t.in` needed unless the action builds free text).
- Coordination ask to i18n: (a) `prefixLookup` typing for `errors.*` key families; (b) a `t.key("errors.email")` typed marker so schema messages are checked keys at build (string literal type, no runtime).

## Security
- CSRF:
  - Router Origin / `Sec-Fetch-Site` check stays the default (SvelteKit model). Gap: request with neither header passes today → forms actions reject when both absent in production (`csrf: "strict"` default for forms actions; `"lax"` opt-out for non-browser clients).
  - Optional token mode `@rivetjs/forms/csrf`: signed double-submit (HMAC of session id + action, hidden `_csrf` input + `SameSite=Lax` `HttpOnly` cookie) for deployments where Origin is stripped by proxies.
  - JSON action responses: `x-content-type-options: nosniff`, `cache-control: no-store`.
- Mass assignment: `fn` receives schema output only (unknown keys stripped by Valibot `object`/Zod default); raw `FormData` available via `event.request` only explicitly.
- Decode hardening: reject path segments `__proto__`, `constructor`, `prototype`; max depth 8; max array index 1000 (configurable; sparse indices compacted, no `new Array(1e9)`); max fields 1000; max key length 256; duplicate scalar keys → last wins (documented).
- Body: size caps per action (413); `content-type` must be urlencoded or multipart (else 415); files capped per file + total; `File.type` not trusted (sniff in app if needed).
- Echo: excluded fields never echoed (passwords, files, `echo.exclude`); echoed values rendered through normal escaping; never put secrets in issues (they land in resume state / HTML).
- Redirects: `safeRedirect(target, fallback)` for user-supplied `redirectTo` (same-origin, path-only).
- CSP: no inline handlers; enhanced fetch uses existing nonce'd chunk loading; Trusted Types unaffected (no HTML sinks).

## Accessibility
- Ids: `fieldId(form, path)` = `${formId}-${path}` (sanitized), `errorId` = `…-error`, `descriptionId` = `…-desc`; stable across server/client.
- `aria-invalid={isInvalid(form, path)}` → `"true"` / absent; `aria-describedby={describedBy(form, path, { description: true })}` → description id + error id only when issues exist (no dangling refs).
- `FieldError`: `<p id={errorId}>` text; not a live region (avoids per-keystroke chatter); announced when field focused via describedby.
- Failed submit (JS): focus first invalid field in DOM order (`formEl.elements`), `scrollIntoView({ block: "center" })`, unless `focusOnInvalid: false`; `ErrorSummary` (`role="alert"`, `tabindex=-1`, list of links `href="#fieldId"`) updated → announced once.
- Failed submit (no JS): server render sets `autofocus` on first invalid field (or on `ErrorSummary` when `focus: "summary"`), page `<title>` prefix "Error: " via head (GOV.UK pattern; i18n key).
- Busy: `aria-busy` on form while submitting; submit buttons stay focusable (`aria-disabled`, not `disabled`, so focus is not lost).
- Field arrays: after insert, focus first input of the new row; after remove, focus next row's first input or the add button; announce via polite status (`ErrorSummary` sibling `FormStatus`, optional).
- Coordination with cdk/aria spec: forms exposes ids + state reads only; aria `Field`/`Label`/`Description` primitives consume `fieldId`/`describedBy`; forms has no dependency on the aria package (and vice versa). Shared contract = id scheme + "issue present" boolean. Revisit when that spec lands.

## Packages / tree-shaking
- `libs/forms` → `@rivetjs/forms` (`sideEffects: false`, one function per module, barrel re-exports only):
  - `.` — `defineForm`, `createForm`, reads, ids, handlers, `validate`, types. Core handler chunk budget ≤ 2.5 KB brotli (excl. schema lib).
  - `./array` — field-array ops (≤ 0.8 KB).
  - `./components` — `FieldError`, `ErrorSummary`, `FormMeta` (`.tsx`, compiled in resume mode; no handlers).
  - `./server` — `action`, `invalid`, `decodeFormData`, `parse`, `safeRedirect`; server graph only (browser import = build error, same guard as `*.server.*`).
  - `./csrf` — token mode (server + hidden input component).
  - `./enhance` is internal: fetch submit lives in a module imported only by `onSubmit`'s enhanced branch via `import()` → loaded on submit intent, not on first input.
- No adapter packages: Standard Schema v1 type is vendored (MIT, types only). Valibot/Zod/ArkType are peer-optional; never imported by forms.
- Router additions live in `@rivetjs/router` (action status/303/JSON data/`revalidate`/`settle` options) — code only on action paths.
- Zero cost: no compiler or runtime change (handlers/bindings are ordinary resume sites); apps without forms import nothing → byte-identical output; ssr-bench untouched (router changes off the GET path; verified by bench re-run + byte comparison).
- Graph tests: `./server` not reachable from client graphs; `.` imports no router server code; schema libs not imported by forms.

## Testing
- Unit (`libs/forms/tests`, `node --test`): path parsing/formatting; `decodeFormData` (coercion table, arrays, files, hardening limits, prototype keys); issue mapping from Valibot/Zod/ArkType fixtures (same expectations, three schema libs); timing state machine (validateOn × revalidateOn matrix); async validator debounce/abort/timeout; dirty from DOM defaults (happy-dom/linkedom fixture).
- Types (`tsc --noEmit` fixtures + `expectTypeOf`): `FieldPath` for nested/arrays/optional/union; invalid paths error; `InferOutput` in action `fn`; `PageProps.action` narrowing; check-time budget on a 200-field schema.
- Server (`libs/router/tests` + forms): action pipeline with `createHandler` — invalid → 400 page with echo/autofocus; redirect 303; JSON enhanced response with/without `data`; intent buttons; CSRF strict (no Origin + no Sec-Fetch-Site → 403); 413/415; multipart file.
- Resume (Chromium/Playwright): zero module requests before interaction; cold first keystroke (no lost chars); cold submit replay → enhanced fetch (one request, no page load); intent prefetch of forms chunk; no component function runs; state size budget; field array insert/remove after resume (`For` adoption).
- No-JS (Playwright `javaScriptEnabled: false`): full signup flow, errors shown, focus via `autofocus`, array intents, file upload.
- A11y: axe-core on error state (JS + no-JS); focus-first-invalid assertions; screen-reader-relevant attributes snapshot.
- i18n: `de` build renders keys translated, server/client same text, no catalog bytes.
- Zero-cost: compiler byte-identical snapshots; ssr-bench HTML identical + Razor comparison re-run.
- Bundle budgets: brotli sizes of core/array/enhance chunks asserted in CI.

## Phases
- P0 — router prerequisites: `action` to pages, `invalid` status, 303 default, JSON `{ data }` single-flight, body limits, CSRF strict mode, client `revalidate` + `settle` options. Tests in `libs/router/tests`.
- P1 — MVP: `defineForm`/`createForm`, Standard Schema validation, coercion, timing modes, delegated handlers, reads/ids, `FieldError`, `action`/`invalid`/`decodeFormData`, no-JS round trip with echo + autofocus, enhanced submit + revalidation, playground signup form (resume + no-JS Playwright), budgets.
- P2: field arrays + intent buttons, async field validators, file uploads, `ErrorSummary`, i18n key typing, multi-form pages (`FormMeta`), CSRF token mode.
- P3: ergonomics — module-ref resume entries enabling `<Form of={form}>` without repeating `def` (open question 1), constraint derivation adapters, `name` attribute type checks, streaming multipart, optimistic `pending` values.

## Open questions (recommended answers)
1. How do resumed handlers reach the non-serializable definition (schema, validators)?
   - A: definition at module scope, passed explicitly at call sites (`onInput(signupForm, form, e)`) — works with today's compiler (module refs are imports).
   - B: new resume entry `{m: "<module>#<export>"}` for module-scope values marked by a compiler static-call hook (like i18n `staticCalls`); store holds `def`; enables `<Form of={form}>` component with internal handlers.
   - C: context token + `createResume({ contexts })` registration.
   - Rec: A for P1 (zero compiler work, zero-cost), B in P3 as a generic runtime feature (also useful to cdk); C rejected (manual client registration, error-prone).
2. Field values: DOM as source of truth vs signals serialized for every field?
   - A: DOM-first (values read on activation; value signals only when bound). B: all values serialized.
   - Rec: A — smaller state, Conform/RHF-proven, keeps zero-JS forms exact; B only for fields with bound reads.
3. FormData naming: dotted (`items.0.qty`) vs bracket (`items[0].qty`)?
   - Rec: dotted — identical to the typed path string (no translation), Modular Forms convention; bracket accepted on decode for interop.
4. Client validation code: always ship schema in handler chunk vs server-only?
   - A: schema in client chunk (default, instant feedback). B: `clientValidation: false` + server `_intent=validate:<path>` on blur (no schema bytes, one request per blur).
   - Rec: A default; B per form for heavy/secret rules. Requires splitting def into universal + server parts (`defineForm({ … })` + `serverSchema` in `.server.ts`) — decide in P2.
5. Status code for validation failure: 400 vs 422 vs 200?
   - Rec: 400 (SvelteKit `fail` default; correct semantics for bad input; browsers render 4xx bodies fine), configurable per action.
6. Native constraint attributes (`required`, `minlength`) derived from schema?
   - Rec: not in core (Standard Schema lacks introspection); P3 optional `@rivetjs/forms/valibot` / `/zod` `constraints(def, path)` helpers. Until then authors write attributes.
7. Type-checking `name="…"` attributes against `FieldPath<T>`?
   - A: TS-only via `name={path(form, "email")}` helper (typed, returns string). B: compiler diagnostic for literal `name` inside a form with known def. C: none.
   - Rec: A in P1 (zero compiler cost); B later if the compiler gains type-aware form facts.
8. Revalidation after a successful enhanced action: re-render route region vs patch store only?
   - Rec: single-flight `data` in the action response + router `revalidate` (re-render route; layouts update in place); skip loaders on `invalid` results; `revalidate: false` per action for pure side effects.
9. Action file convention pending server-markers spec?
   - Rec: forms API independent of convention (`action(def, fn)` returns a plain handler); only the router registration point changes. Re-check when that spec lands.
10. CSRF default for forms actions when Origin and Sec-Fetch-Site are both missing?
   - Rec: reject in production (403) — all browsers since 2020 send Origin on POST; `csrf: "lax"` opt-out; token mode for stripping proxies.
11. Error display gating: show issues only for touched fields vs immediately?
   - Rec: touched-or-submitted (RHF/Modular Forms default); `showIssues: "always"` option for server-provided issues (always shown after POST).

## Decisions (user, 2026-10-03)
- Scope grows: v1 must handle multi-step wizards, conditional fields, autosave/drafts, reusable sub-forms, server-driven errors. Principle: forms ships primitives; app owns policy (storage, URLs, backend error shapes).
- Architecture: core + opt-in layers (approach A), each its own entry, zero bytes unless imported:
  - `@rivetjs/forms/scope` — `scope(form, "billing")` → typed view rooted at a path (names `billing.city`, issues/ids/handlers relative). One store, one submit; schema composed by the app (`billing: addressSchema`). Same component reused for shipping. Many independent forms per page keep the existing form-id ordinal.
  - `@rivetjs/forms/wizard` — schema per step: each step is its own `defineForm`; `defineWizard({ steps: [account, address, confirm], final? })` composes them; final value = merge of step outputs (cross-step rules live in `final` schema). State only: current step, completed steps, per-step results, `next/back/goTo`, step guard (cannot skip past an invalid step). Routing is the app's call (query param, route per step, or in-page) — wizard exposes `step` signal + `stepFromUrl`/`stepHref` helpers, no router coupling. No-JS: each step posts to its action; server stores step output via the app's `DraftStore`, then redirects/renders next step.
  - `DraftStore` interface (app implements; no built-in stores): `load(id, event)`, `save(id, patch, { version }, event) → { version } | conflict`, `delete(id, event)`. Draft id travels as hidden `_draft` input + optional URL param chosen by the app. Used by wizard and autosave.
  - `@rivetjs/forms/autosave` — debounced save of changed fields (patch) on input/blur via the app's save function (server action or `DraftStore`); signals `saving`, `savedAt`, `saveError`, `conflict`; version token echoed each save, 409/conflict result → `conflict` state with the server's version for the app to resolve. Drafts may be partially invalid (schema not enforced on save; optional per-field check). Leave guard: router `beforeLeave` when dirty and unsaved.
  - `@rivetjs/forms/errors` — `mapIssues(unwrap)`: app supplies `unwrap(backendError) → { path, key | message, params? }[]` for whatever its backend returns (JSON pointer, GraphQL path, `a.b[0]` strings — helpers `fromPointer`, `fromBracketPath` provided); unknown/unmatched paths → form-level issues. Usable in actions (`invalid(mapIssues(...))`) and client (`setIssues`).
- Conditional fields: schema decides. An input removed from the DOM is not submitted; discriminated-union schema validates the active branch; re-shown field restores its last client value when one exists. No `keep` option.
- Dependent async options (country → regions): no forms API. `value(form, "country")` signal + router loader/resource; docs recipe; stale dependent value rejected by schema.
- Async field checks: existing `fields.<path>.validate` (debounced, abortable) + server `_intent=validate:<path>`; first-class, in v1 (not deferred to P2).
- Open questions resolved by user picks: Q1 = a, Q4 = a; all others = recommended (Q10: reject in production with 403 when Origin and Sec-Fetch-Site are both missing).
