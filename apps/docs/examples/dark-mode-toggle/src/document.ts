import { headTags, type DocumentShell } from "@rivetjs/router/server";

// Runs before the page paints: applies the saved theme, or the system one. No flash of the wrong colours.
const themeScript =
  'try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}';

/** The HTML around every page. */
const document: DocumentShell = ({ head, styles, nonce }) => ({
  start:
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    // A server app gets a nonce for its inline scripts; a static build allows the script by its hash.
    `<script${nonce ? ` nonce="${nonce}"` : ""}>${themeScript}</script>` +
    '<meta name="color-scheme" content="light dark">' +
    headTags({ title: head?.title ?? "Rivet app" }) +
    styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("") +
    "</head><body>",
  end: "</body></html>",
});
export default document;
