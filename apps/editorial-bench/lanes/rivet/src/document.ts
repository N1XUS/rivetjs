import { headTags, type DocumentShell } from "@rivetjs/router/server";

// Same <head> as every lane: charset, viewport, title, description, /site.css.
const document: DocumentShell = (input) => ({
  start:
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    headTags({ ...input.head, title: input.head?.title ?? "The Daily Fixture" }, input) +
    '<link rel="stylesheet" href="/site.css"></head><body>',
  end: "</body></html>",
});
export default document;
