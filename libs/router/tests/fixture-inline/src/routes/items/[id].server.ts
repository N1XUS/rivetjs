// Sibling server module next to in-file exports: merged with the page's in-file exports.
import { headers } from "@rivetjs/router";
export const responseHeaders = headers(() => ({ "x-item": "1" }));
