import { byAuthor, byTag, day, loadSite, pageCount, pageItems } from "../../../fixture/load.mjs";

let cache;
export const load = () => (cache ??= loadSite(process.env.EDITORIAL_CONTENT));
export { byAuthor, byTag, day, pageCount, pageItems };
