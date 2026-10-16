import type { DocumentShell } from "@rivetjs/router/server";
import { headTags } from "@rivetjs/router/server";

const document: DocumentShell = ({ head, locale, dir }) => ({
  start: `<!doctype html><html lang="${locale ?? "en"}" dir="${dir ?? "ltr"}"><head><meta charset="utf-8">${headTags(head)}</head><body><div id="app">`,
  end: "</div></body></html>",
});
export default document;
