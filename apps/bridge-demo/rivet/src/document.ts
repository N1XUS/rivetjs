import { headTags, type DocumentShell } from "@rivetjs/router/server";

/** The HTML around every page (route `head` + stylesheets + CSP nonce). */
const document: DocumentShell = (input) => ({
  start:
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    headTags({ ...input.head, title: input.head?.title ?? "Ops dashboard" }, input) +
    "</head><body>",
  end: "</body></html>",
});
export default document;
