import { headTags, type DocumentShell } from "@rivetjs/router/server";

const icon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230f766e'/%3E%3Ctext x='8' y='24' font-size='23' font-family='sans-serif' fill='white'%3ER%3C/text%3E%3C/svg%3E";

/** Document around every page: route heads merge in after the site defaults. */
const document: DocumentShell = ({ head, styles, inlineStyles, nonce }) => ({
  start:
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    headTags({
      title: head?.title ?? "Rivet playground",
      meta: head?.meta?.some((m) => m.name === "description") ? head.meta : [{ name: "description", content: "Rivet compiled JSX framework example" }, ...(head?.meta ?? [])],
      ...(head?.links ? { links: head.links } : {}),
    }) +
    `<link rel="icon" href="${icon}">` +
    // Stylesheets: linked, or inline when small (`rivetRouter({ inlineStylesheets })`, nonce'd on server pages).
    headTags(undefined, { styles, inlineStyles, nonce }) +
    '</head><body><div id="app">',
  end: "</div></body></html>",
});
export default document;
