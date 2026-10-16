import { byAuthor, byTag, day, loadSite, pageCount, pageItems } from "../../../../fixture/load.mjs";

let cache;
export const load = () => (cache ??= loadSite(process.env.EDITORIAL_CONTENT));
export const teaser = (a) => ({ slug: a.slug, title: a.title, date: a.date, day: day(a.date), author: a.author, description: a.description });
export { byAuthor, byTag, day, pageCount, pageItems };
