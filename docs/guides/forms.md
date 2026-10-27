# Forms (`@rivetjs/forms`)

Type-safe, resumable, progressively enhanced forms over Standard Schema v1 (Zod, Valibot, ArkType, hand-written). Design: [spec](../design/specs/2026-10-03-forms-design.md), [plan](../design/plans/2026-10-03-forms.md). Runnable demo: `libs/forms/tests/app` (signup, wizard, field array, same-URL notes, autosave leave guard).

## Model

- Definition (`defineForm`, module scope): schema, coercion, timing, field checks. Never serialized; handlers and actions import it.
- Store (`createForm(def, { id?, initial?, result: actionResult() })`, component local): ids, status bits, submit count, issues per touched/bound field. Serializes small (10 bound fields < 400 B). DOM owns values.
- Handlers on the `<form>` (delegated, one chunk): `onInput`, `onBlur` (as `onFocusOut`), `onSubmit`, `onInvalid` (as `onInvalidCapture`; `invalid` does not bubble). Pass the definition explicitly: `onInput(signupForm, form, e)`.
- Native constraints (`required`, `type="email"`) for no-JS posts: on a resumed page native validation stays on until a form handler runs, so the first submit of an untouched form is stopped before `submit` fires. `onInvalidCapture={(e) => onInvalid(def, form, e)}` takes over from that attempt: `noValidate` on, library messages + focus, once per pass, never submits (next submit → `onSubmit`). The preload planner treats `invalid` as intent-class (no visible preload). Cold (chunk not loaded yet): the native bubble may show once.
- No JS: native POST to `?/name` → action → 303 redirect, or 400 page with issues, echoed values (`defaultValue`/`defaultChecked`), `autofocus` on the first invalid field.
- JS: `onSubmit` validates (field checks awaited, `asyncTimeout`), focuses first invalid, else fetch (`accept: application/json`) → JSON redirect routed through the app router (`navigate()`; a redirect to the shown URL — PRG back to the form's page — revalidates instead, `transport.ts` `follow`, from the answer's fresh data when the server sent it: no second request), or issues, or success (`lastResult`, reset, page revalidated from the answer's fresh route data: single flight, no extra request; `revalidate: false` opts out; see [routing](routing.md#file-routes-revalidation)). Route data prefetched before the submit is dropped.
- `onSubmit` → `Promise<boolean> | undefined`: `true` once the server accepted the submit and the page is fresh (revalidation awaited / redirect served), `false` for client or server issues, failures, aborted submits, array intents, `enhance: false`; `submitting()` stays on until then. Overlay forms: `onSubmit={async (e) => (await onSubmit(def, form, e)) && open.set(false)}` on a live page (`export const live = true`, [routing](routing.md#file-routes-live-pages)) — the page is not re-rendered, so the overlay's open signal, other page state and focus survive; issues keep it open. No JS: open the overlay on the server for `?new`-style URLs and after a failed POST (`actionResult(name)?.status >= 400`). Demo `libs/forms/tests/drawer-app`, e2e `tests/drawer.test.ts`, docs example `apps/docs/examples/drawer-form`.
- Custom transport: `defineForm({ submit: async (value, { formData, element, signal, submitter, form }) => … })` replaces the router-action fetch (third-party endpoint, client-only logic). Valid submit → `submitting()` on while it runs; resubmit aborts `signal` (late result ignored); return `{ ok: false, issues?, form? }` (`IssueLike` values) → issues shown, fields armed, first invalid focused; `{ ok: true, data }` / any value → `lastResult()`, reset (`resetOnSuccess`); throw → form issue `errors.submit` (`message` = error's). No revalidate/redirect (call `navigate` yourself). No JS: native POST to the form's `action` (set it to the same endpoint). Lazy `submit.ts` chunk via `enhance.ts`; plain forms pay ~0 (handler chunk +19 B min / +7 B gz). Resumable: the definition is a module import, never serialized.
- `focusFirstInvalid(form, element?)`: focus + scroll to the first control showing issues (else `#<id>-summary`); for custom flows (`validate()` then own submit).

## Page

```tsx
const form = createForm(signupForm, { result: actionResult() });
<form id={formId(form)} method="post" action="?/signup"
  onInput={(e) => onInput(signupForm, form, e)} onFocusOut={(e) => onBlur(signupForm, form, e)} onSubmit={(e) => onSubmit(signupForm, form, e)}>
  <ErrorSummary of={form} />
  <input id={fieldId(form, "email")} name="email" value={defaultValue(form, "email")} autoFocus={autofocus(form, "email")}
    aria-invalid={isInvalid(form, "email")} aria-describedby={describedBy(form, "email")} />
  <FieldError of={form} name="email" />
</form>
```

- Reads (bindings): `issues`, `issue`, `issueText(format?)`, `isInvalid`, `fieldIssues`, `formIssues`, `touched`, `dirty`, `value`, `submitting`, `submitted`, `submitCount`, `validating`, `lastResult`.
- Ids: `formId`, `fieldId`, `errorId`, `descriptionId`, `summaryId`, `describedBy`, `path` (typed `name`).
- Imperative: `setValue`, `setIssues` (`""` = form level), `clearIssues`, `reset`, `validate`, `focusFirstInvalid`.
- Components (`/components`): `FieldError`, `ErrorSummary` (`role="alert"`, links to fields), `FormMeta` (`_form` for several instances of one definition), `FormStatus`.
- Rejected async schemas during input/change/blur produce an `errors.check` issue on the triggering field, following the usual armed-field visibility rules. Newer validation supersedes stale failures; a successful run clears the issue.
- Timing: `validateOn` (`submit` default, `blur`, `input`, `change`) for pristine fields; `revalidateOn` (`input` default) once a field shows issues; cross-field rules revalidate armed dependents.
- Messages are issue keys or literal messages; i18n: pass `format` (no i18n dependency).

## `@rivetjs/ui` Form

- `<Form form={form} definition={signupForm}>` (`@rivetjs/ui/form`): `id` / `method="post"` / `action="?/<name>"` / `validationBehavior="aria"`; delegated `onInput` / `onFocusOut` (on a `display: contents` child wrapper: cdk Form forwards no input events) + `onSubmit` / `onInvalid` on the form. User `onSubmit(event, result)` / `onInvalid` run after.
- Issues → cdk `validationErrors` by name (`fieldIssues`, `formatIssue(issue, format)`): every named cdk/ui field shows `aria-invalid`, `aria-describedby`, its `FieldError`. TextField shorthand always renders a `FieldError`.
- `FormFieldsContext` (`libs/ui/src/utils/form-fields.ts`, resumable `rv-ui-form-fields`, no forms import → fields zero-cost): TextField without `value` / `defaultValue` echoes `defaultValue(form, name)`; `type="submit"` Button without `isPending` → `submitting(form)`.
- Demo route `libs/forms/tests/app/src/routes/ui-signup.tsx` (e2e JS + no JS in `tests/app.test.ts`); unit `libs/ui/tests/form-store.test.tsx`. User docs: ui-docs `start/forms`, `components/form` "With @rivetjs/forms".

## Server (`/server`, server only)

- `export const forms = actions({ signup: action(signupForm, (value, event, { data, id, intent }) => …, options) })`.
- Pipeline: CSRF → content type (415) → bounded body (413; 1 MiB urlencoded, 10 MiB multipart, `limits.file`) → `_form`/`_intent` → decode (400 on hardening limits) → schema → server field checks (`fields.*.server`, `options.checks`) → handler.
- Handler returns data (`{ ok: true, id, data }`), `invalid(issues | mapIssues(...), form?, status?)`, `redirect(...)` (303), a `Response`, or throws.
- CSRF: the router already rejects cross-site posts and provenance-less form posts (production) before the action; `"strict"` (default) also rejects posts with neither `Origin` nor `Sec-Fetch-Site` of any type in production (dev exempt); `"lax"`: router check only; token mode `@rivetjs/forms/csrf` (`csrfToken`, `verifyCsrf`: HttpOnly SameSite=Lax nonce cookie + HMAC field).
- Echo: strings only; files and names matching `/password|secret/i` never echoed; `echo.exclude` paths/patterns add to that default (never replace it).
- `parse(def, formData | request)`, `readForm(request, limits)`, `decodeFormData`, `safeRedirect(target, fallback)` (re-export of the router's).

## Layers

- `/scope`: `scope(form, "billing")` → typed view (names, ids, issues relative). One store, one submit.
- `/array`: `keys(form, "items")` for `For` (by key), `insert`/`remove`/`move`/`swap`/`replace` (records move with rows; focus new row). Intent buttons `<button type="submit" name="_intent" value={insertIntent("items")}>`: browser-applied by `onSubmit`, server-applied to the echo without JS. Row defaults by key: `defaultValue(form, \`items.${key()}.sku\`)`.
- `/errors`: `mapIssues(error, unwrap, { known })` → `{ path, key, message?, params? }[]`, unknown paths → form level; `fromPointer`, `fromBracketPath`, `issueRecord` (for `setIssues`).
- Field checks: `fields: { email: { validate: async (value, { signal }) => …, debounce, server: true } }` or `remote: true` (posts `_intent=validate:<path>`; action answers from schema + `checks`).
- `/wizard`: `defineWizard({ id, steps: [defA, defB, defC], final? })`, `createWizard`, `step`, `next`, `back`, `goTo` (no skipping past incomplete steps), `stepFromUrl`, `stepHref`. Server: `export const forms = actions(wizardAction(wizard, drafts, { onComplete }))` (one action per step; output saved in the app's `DraftStore`; redirect to next step; last step merges, checks `final`, deletes draft), `loadWizard(wizard, drafts, event)` (call inside `load(…)`).
- `DraftStore` (app implements): `load(id, event)`, `save(id, patch, { version }, event) → { ok, version } | { ok: false, conflict, version, value? }`, `delete(id, event)`. Draft id: hidden `_draft` + `?draft=`; scope ids to the session.
- `/autosave`: `defineAutosave({ save: postDraft("?/draft"), debounce })`, `createAutosave({ version, draft })`, `onAutosave` (input/focusout), `markChanged`, `flush`, `resolveConflict`; reads `saving`, `savedAt`, `saveError`, `conflict`, `unsaved`, `shouldBlockLeave`; leave guard `clientEffect(() => guardLeave(auto, { message? }))` (router `beforeLeave`: links and back/forward confirm, unload gets the browser prompt). Server `draftAction(drafts)` (409 on stale version).

## Limits and notes

- No automatic per-render form ids: pass `id` when a page renders one definition twice (plus `FormMeta`).
- No "Error:" title prefix on failed no-JS posts (heads run without the action result).
- Router pages boot the router at idle for client navigation; form code loads only on the first form event.
