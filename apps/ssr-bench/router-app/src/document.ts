import { headTags, type DocumentShell } from "@rivetjs/router/server";
import { PAGE_STYLE } from "../../fixture/style.ts";

// Same document as the other lanes: head from the route's `head` export, inline page style; the
// `<!--complete-->` marker the bench validator requires closes the body (other lanes write it last).
const document: DocumentShell = ({ head, nonce }) => ({
  start: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${headTags(head, nonce === undefined ? {} : { nonce })}<style>${PAGE_STYLE}</style></head><body>`,
  end: "<!--complete--></body></html>",
});
export default document;
