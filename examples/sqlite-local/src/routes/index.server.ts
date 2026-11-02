import { actions, load, redirect, type RequestEvent } from "@rivetjs/router";
import { allTags, countBookmarks, createBookmark, deleteBookmark, getBookmark, getDb, listBookmarks, parseInput, updateBookmark } from "../server/db.server.ts";

const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

/** Search (`q`), tag filter (`tag`) and keyset cursor (`before`) come from the URL; `edit` opens one row's form. */
export const loader = load((event: RequestEvent) => {
  event.depends("bookmarks");
  const db = getDb();
  const p = event.url.searchParams;
  const page = listBookmarks(db, { q: p.get("q") ?? "", tag: p.get("tag") ?? undefined, before: num(p.get("before")), limit: 20 });
  const editId = num(p.get("edit"));
  // `?error=` carries a code, never text: a crafted link cannot put its own message in the alert.
  const error = ERRORS[p.get("error") ?? ""] ?? null;
  return { ...page, tags: allTags(db), total: countBookmarks(db), editing: editId ? getBookmark(db, editId) : null, error };
});

/** Error codes the forms redirect with → the message the page shows. */
const ERRORS: Record<string, string> = {
  "title-required": "Title is required",
  "title-long": "Title is too long",
  "url-scheme": "Use an http(s) URL",
  "url-invalid": "Enter a valid URL",
  "unknown-bookmark": "Unknown bookmark",
};
const codeOf = (message: string | undefined) => Object.keys(ERRORS).find((code) => ERRORS[code] === message) ?? "url-invalid";

/**
 * Redirect back to the list with the visitor's search (`q`) and tag filter (`tag`). The forms post to `?/<action>`
 * (no filter in that URL), so the page renders them as hidden fields and they come back with the form data.
 */
const back = (event: RequestEvent, form: FormData, error?: string) => {
  const url = new URL("/", event.url);
  for (const k of ["q", "tag"]) {
    const v = form.get(k) ?? event.url.searchParams.get(k);
    if (typeof v === "string" && v) url.searchParams.set(k, v);
  }
  if (error) url.searchParams.set("error", codeOf(error));
  return redirect(url.pathname + url.search, 303);
};

export const forms = actions({
  create: async (event: RequestEvent) => {
    const form = await event.request.formData();
    const r = parseInput({ title: form.get("title"), url: form.get("url"), tags: form.get("tags") });
    if (!r.ok) return back(event, form, Object.values(r.issues)[0]);
    createBookmark(getDb(), r.value);
    return back(event, form);
  },
  update: async (event: RequestEvent) => {
    const form = await event.request.formData();
    const id = num(String(form.get("id") ?? ""));
    const r = parseInput({ title: form.get("title"), url: form.get("url"), tags: form.get("tags") });
    if (!id || !r.ok) return back(event, form, r.ok ? "Unknown bookmark" : Object.values(r.issues)[0]);
    updateBookmark(getDb(), id, r.value);
    return back(event, form);
  },
  remove: async (event: RequestEvent) => {
    const form = await event.request.formData();
    const id = num(String(form.get("id") ?? ""));
    if (id) deleteBookmark(getDb(), id);
    return back(event, form);
  },
});
