import type { DocumentShell } from "@rivetjs/router/server";
import { headTags } from "@rivetjs/router/server";

const document: DocumentShell = ({ head, styles }) => ({
  start: `<!doctype html><html lang="en"><head><meta charset="utf-8">${headTags(head)}${styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("")}</head><body><div id="app">`,
  end: "</div></body></html>",
});
export default document;
