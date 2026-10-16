import { headTags, type DocumentShell } from "@rivetjs/router/server";

/** The HTML around every page. `locale` and `dir` come from the i18n guard. */
const document: DocumentShell = (input) => ({
  start:
    `<!doctype html><html lang="${input.locale ?? "en"}" dir="${input.dir ?? "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    headTags({ ...input.head, title: input.head?.title ?? "Rivet app" }, input) +
    "</head><body>",
  end: "</body></html>",
});
export default document;
