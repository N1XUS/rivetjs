import { bodyAttributes, bodyTags, headTags, htmlAttributes, type DocumentShell } from "@rivetjs/router/server";

/**
 * The HTML around every page. The route `head` (title, meta, links, scripts, `<html>` / `<body>` attributes, end-of-body
 * scripts) is written in full; `input` carries the stylesheets, the CSP nonce (server pages) and the client-managed
 * marks of `@rivetjs/kit` head components.
 */
const document: DocumentShell = (input) => ({
  start:
    `<!doctype html><html${htmlAttributes(input.head, { lang: "en" })}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    headTags({ ...input.head, title: input.head?.title ?? "Bookmarks" }, input) +
    `</head><body${bodyAttributes(input.head)}>`,
  end: bodyTags(input.head, input) + "</body></html>",
});
export default document;
