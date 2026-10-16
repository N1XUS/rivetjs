import type { DocumentShell } from "@rivetjs/router/server";
import { bodyAttributes, headTags, htmlAttributes } from "@rivetjs/router/head";

// Kit shells pass the whole input: stylesheets, the CSP nonce and the client-managed marks.
const document: DocumentShell = (input) => ({
  start: `<!doctype html><html${htmlAttributes(input.head, { lang: "en" })}><head><meta charset="utf-8">${headTags(input.head, input)}</head><body${bodyAttributes(input.head)}><div id="app">`,
  end: "</div></body></html>",
});
export default document;
