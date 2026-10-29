# examples/forms-in-overlays

- Contacts are in-memory and server-only (`src/server/contacts.server.ts`); restart restores the five seeds. No external services or credentials.
- Page `live = true`, `clientRouter: true`, and imported `navigate` enable in-place page/layout data refresh. The layout count must follow create/delete without replacing the page.
- `?new` / `?edit=<id>` / `?delete=<id>` render overlays open without JS. Failed POSTs reopen their overlay from `actionResult`, echoing field values (including update's id). Successful actions return `redirect("/")`: native PRG / enhanced single-flight revalidation.
- One definition/store per action (`create`, `update`, `remove`). Contact `id` is a hidden field, distinct from the form element's id. Do not rename it to hide the forms DOM-property-shadowing regression: ownership in `libs/forms/dom.ts` must read `getAttribute("id")`.
- New/Edit/Delete buttons render anchors with query URLs, prevented on enhanced clicks. Every overlay has a Cancel anchor to `/` for no-JS visitors; Escape / close buttons work after resume. Close on submit only after the forms result resolves true.
- Intercept only plain primary clicks so modified clicks keep the anchor's new-tab/window behaviour. Each form renders `FormStatus` for pending state and form-level/network/server issues; field errors alone cannot report a failed request. The retry regression aborts an action request, checks visible feedback/retained values, then retries successfully.
- `EditContact` owns its initial values and update store; test switching contacts so a previous id/value cannot be submitted for another row.
- Tests: `tests/app.test.ts`, vitest project `examples`, sequential production build + server on 4474 + one Chromium at a time. Includes no-JS flows, failed POST echo, duplicate email, correct edit ids, list/layout updates without document navigation, CSRF and bootstrap JS budget.
- Run/check commands and pinned dependency versions: `README.md`, `package.json`. Examples resolve packages from the root installation (not separate workspaces).
