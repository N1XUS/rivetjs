// Ported from react-aria-components (packages/react-aria-components/test/Dialog.ssr.test.js), react-spectrum,
// Apache-2.0, © Adobe.
// Changes: server render through `server.ts` (`renderHtml`, resume mode) into happy-dom instead of
// `testSSR` + hydration. Deviation (intended): React Aria never server-renders an open modal (its
// Overlay waits for a mounted effect); Rivet renders it into the server HTML (the page resumes, no
// hydration re-render), so the assertion is inverted: the dialog IS in the server HTML, labelled by its
// title, and the trigger's aria-expanded / aria-controls point at it.
import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";
import { importModule, renderHtml } from "./server.ts";

// Compiled as a cdk module (`@rivetjs/cdk/tests/fixtures/…`): the cdk components it renders are source-package
// components, so its JSX children / callback props are resumable (R2), as in an app build with `rivet()`.
const fixture = await importModule<{ SignUp(): unknown; SignUpCustomId(): unknown; SignUpDialogId(): unknown }>("tests/fixtures/dialog-ssr-fixture.tsx");
// Rendered before any test installs happy-dom (a server render must not see a `document`).
const customIdHtml = await renderHtml(() => fixture.SignUpCustomId());
const dialogIdHtml = await renderHtml(() => fixture.SignUpDialogId());

describe("Dialog SSR", () => {
  test("should render without errors", async () => {
    // Render without a DOM (a real server), then parse the HTML into happy-dom.
    const html = await renderHtml(() => fixture.SignUp());
    installDom();
    document.body.innerHTML = html;
    const dialog = document.querySelector('[role="dialog"]')!;
    assert.ok(dialog, "server HTML contains the open dialog");
    assert.equal(dialog.getAttribute("class"), "rv-Dialog");
    const heading = dialog.querySelector("h2")!;
    assert.equal(heading.textContent, "Sign up");
    assert.equal(dialog.getAttribute("aria-labelledby"), heading.id, "labelled by the title slot in the server HTML");
    const trigger = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Sign up…")!;
    assert.equal(trigger.getAttribute("aria-expanded"), "true");
    assert.equal(trigger.getAttribute("aria-controls"), dialog.id);
    assert.ok(dialog.closest(".rv-Modal") && dialog.closest(".rv-ModalOverlay"));
  });

  test("a title with its own id labels the dialog in the server HTML", async () => {
    installDom();
    document.body.innerHTML = customIdHtml;
    const dialog = document.querySelector('[role="dialog"]')!;
    const heading = dialog.querySelector("h2")!;
    assert.equal(heading.id, "sign-up-title");
    assert.equal(dialog.getAttribute("aria-labelledby"), "sign-up-title", "aria-labelledby follows the title's own id");
  });

  // Rivet (CDK-PINS 2026-10-12): the trigger renders before the Dialog; the server-open DialogTrigger probes for the
  // Dialog's own id so aria-controls is not left at the generated id (the client render follows the merge).
  test("a dialog with its own id is the open trigger's aria-controls in the server HTML", async () => {
    installDom();
    document.body.innerHTML = dialogIdHtml;
    const dialog = document.querySelector('[role="dialog"]')!;
    assert.equal(dialog.id, "sign-up-dialog");
    const trigger = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Sign up…")!;
    assert.equal(trigger.getAttribute("aria-controls"), "sign-up-dialog");
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 1, "the probe renders nothing");
  });
});
