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
  return { ...page, tags: allTags(db), total: countBookmarks(db), editing: editId ? getBookmark(db, editId) : null, error: p.get("error") };
});

const back = (event: RequestEvent, error?: string) => {
  const url = new URL("/", event.url);
  for (const k of ["q", "tag"]) {
    const v = event.url.searchParams.get(k);
    if (v) url.searchParams.set(k, v);
  }
  if (error) url.searchParams.set("error", error);
  return redirect(url.pathname + url.search, 303);
};

export const forms = actions({
  create: async (event: RequestEvent) => {
    const form = await event.request.formData();
    const r = parseInput({ title: form.get("title"), url: form.get("url"), tags: form.get("tags") });
    if (!r.ok) return back(event, Object.values(r.issues)[0]);
    createBookmark(getDb(), r.value);
    return back(event);
  },
  update: async (event: RequestEvent) => {
    const form = await event.request.formData();
    const id = num(String(form.get("id") ?? ""));
    const r = parseInput({ title: form.get("title"), url: form.get("url"), tags: form.get("tags") });
    if (!id || !r.ok) return back(event, r.ok ? "Unknown bookmark" : Object.values(r.issues)[0]);
    updateBookmark(getDb(), id, r.value);
    return back(event);
  },
  remove: async (event: RequestEvent) => {
    const id = num(String((await event.request.formData()).get("id") ?? ""));
    if (id) deleteBookmark(getDb(), id);
    return back(event);
  },
});
