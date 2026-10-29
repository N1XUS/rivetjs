# forms-in-overlays

A contacts list with a create drawer, edit modal and delete confirmation. Each overlay contains a real POST form. Validation errors keep it open with the submitted values; success refreshes the list and the layout's contact count in place and closes it.

Contacts live in memory. Restart the server to restore the five seeded contacts.

## Run

From the repository root, install dependencies once with `npm ci`, then:

```sh
cd examples/forms-in-overlays
npm run build
npm start                # http://127.0.0.1:3000
```

Dev: `npm run dev`. Check types and Rivet diagnostics: `npm run check`. Set `PORT` / `HOST` to change the production address.

The examples use the repository's installed packages; they are not separate npm workspaces yet.

## What it shows

- `src/routes/index.tsx`: a live page (`export const live = true`), actions and a keyed contacts list. `?new`, `?edit=<id>` and `?delete=<id>` open the matching overlay on the server, so the links work without JavaScript.
- `src/routes/_layout.tsx`: a loader for the total count, refreshed with the page after a successful action.
- `src/forms/contact.ts`: shared Zod definitions for create, update and remove. The update and remove forms carry the selected contact's `id` in a hidden input. Each store has its own form id (`create`, `update`, `remove`).
- `Form form definition` + named `TextField`s: client/server validation, echoed values and field errors, including the case-insensitive duplicate-email check.
- `FormStatus` reports pending submissions and request failures; an unsuccessful request keeps the entered values for retry.
- `onSubmit`: await the forms result and close only on success. Cancel links work without JavaScript too; with JavaScript the overlays also support Escape and their close buttons.
- Successful actions redirect to `/` (303 for a native POST, fresh loader data in the enhanced response), so reloading does not repeat a mutation. Failed POSTs render the appropriate overlay again.
- `src/server/contacts.server.ts`: the in-memory store stays out of browser bundles. `/healthz` comes from the node adapter.

## Test

From the repository root:

```sh
npx playwright install chromium
npx vitest run --project examples --maxWorkers=1
```

The suite builds and boots the production app on port 4474. It checks native POSTs, validation and echoed values, JavaScript-disabled CRUD and cancellation, cold drawer submission, repeated edits with the correct hidden id, request-failure feedback and retry, and updates without a document reload. Bootstrap script assets have a 40 KB budget. CI installs Chromium with its system dependencies.

Versions verified 2026-10-29: Node 26.5 (Node >= 24 required), Vite 8.3.2, Tailwind CSS 4.3.3, Zod 3.25.76.
