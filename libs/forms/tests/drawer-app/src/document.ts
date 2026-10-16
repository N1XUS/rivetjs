import { headTags, type DocumentShell } from "@rivetjs/router/server";

const document: DocumentShell = ({ head, styles }) => ({
  start: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${headTags(head)}${styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("")}</head><body><div id="app">`,
  end: "</div></body></html>",
});
export default document;
