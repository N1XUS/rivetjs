// Browser-side helpers of the docs components, called from their resumed handlers only (never during
// render). A .ts module: the compiler does not rewrite it for the server, so browser globals are fine.
// Mutable state lives in objects: resumed handler chunks import module bindings, which are read-only.

/** Scroll-spy: mark the TOC link of the last heading above the reading line (both TOC copies). */
export function spy() {
  spyState.queued = false;
  const headings = document.querySelectorAll<HTMLElement>(".prose h2[id], .prose h3[id]");
  if (!headings.length) return;
  const line = 120;
  let active: HTMLElement | undefined;
  const bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
  if (bottom) active = headings[headings.length - 1];
  else for (const heading of headings) if (heading.getBoundingClientRect().top <= line) active = heading;
  const id = active?.id;
  for (const link of document.querySelectorAll<HTMLAnchorElement>(".toc-list a")) {
    if (link.hash.slice(1) === id) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  }
}
export const spyState = { queued: false };

export type ThemePref = "system" | "light" | "dark";

/** Saved preference (`data-theme-pref`, set by the document's pre-paint script). */
export function currentPref(): ThemePref {
  const pref = document.documentElement.dataset.themePref;
  return pref === "light" || pref === "dark" ? pref : "system";
}

/** Apply and remember a preference. The pre-paint script (../document.ts) applies it on later pages. */
export function applyPref(pref: ThemePref) {
  const root = document.documentElement;
  root.dataset.themePref = pref;
  root.dataset.theme = pref === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : pref;
  try {
    if (pref === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", pref);
  } catch {
    /* Storage blocked: the choice lasts for this page only. */
  }
}

/** Current path, for content rendered in the browser only (the mobile drawer's render function). */
export const currentPath = () => location.pathname;
