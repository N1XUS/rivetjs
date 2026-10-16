# @rivetjs/forms/server

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Server half of forms: form definitions → router actions (convention-agnostic `(event) => result`), wizard step actions, autosave draft endpoint, no-JS array intents. Server only.

## Entry points

- `@rivetjs/forms/server` → `index.ts`: `action`, `invalid`, `parse`, `readForm`, `safeRedirect`, `wizardAction`, `loadWizard`, `draftFrom`, `draftAction`; re-exports `decodeFormData`/`FormDecodeError` (`../decode.ts`), `DraftStore` & wizard types (`../wizard.ts`), `FormReply` (`../store.ts`).
- `browser` condition of `./server` and `./csrf` → `browser.ts`: throws on import (keeps body parsing / secrets out of client graphs).

## Layout

- `action.ts` — `action(def, fn, options)`, `invalid`, `parse`, `readForm` (bounded body), CSRF modes, echo, remote field checks.
- `intents.ts` — `parseIntent` / `applyIntent`: `insert|remove|move|swap:<path>[:…]` applied to echoed raw values (internal; used by `action.ts`).
- `wizard.ts` — `wizardAction` (one action per step → `DraftStore`, redirect to next step; last step merges, checks `final`, `onComplete`, deletes draft), `loadWizard` (inside `serverLoad`), `draftFrom` (`_draft` field / `?draft=`).
- `draft.ts` — `draftAction(drafts)`: merges raw autosave patch; 409 + `{ conflict, version, value }` on stale version.
- `redirect.ts` — re-export of `@rivetjs/router` `safeRedirect` (open-redirect guard).
- `browser.ts` — throwing browser stub.

## Rules / invariants

- Pipeline order (`action.ts`): CSRF → content type (415) → bounded body (413; urlencoded 1 MiB, multipart 10 MiB, `limits.file`) → `_form`/`_intent` → decode (400 on hardening limits) → schema → server field checks (`fields.*.server`, `options.checks`) → handler.
- Failures answer `fail(status ?? 400, FormReply)`: same reply renders the no-JS page (issues, echo, `autofocus`) and the enhanced JSON answer.
- CSRF `"strict"` (default): router check + production reject of posts with neither `Origin` nor `Sec-Fetch-Site` (dev exempt). `"lax"`: router check only. Function (e.g. `verifyCsrf`) runs after the strict check.
- Echo (`echoValues`, `action.ts`): strings only, files dropped; names matching `/password|secret/i` ALWAYS dropped; `defineForm({ echo: { exclude } })` adds paths / `$` index patterns on top (union — never replaces the default; test in `server.test.ts`).
- Array intents on no-JS posts re-render with applied echo instead of running the handler (`maxRows` 1000).
- Draft ids come from the client: apps must scope `DraftStore` ids to the session.
- Never import from client modules; apps import it from `*.server.ts`.

## Commands

Tests live in `../tests/` (`server.test.ts`, `wizard.test.ts`, `autosave.test.ts`, `csrf.test.ts`), run via `npx vitest run --project forms` (see `../CLAUDE.md`). They drive the real router handler (`../../router/server/handler.ts`).

## See also

- `../CLAUDE.md`, `../../../docs/guides/forms.md` (Server, Layers), `../../../docs/guides/routing.md` (actions, CSRF)
