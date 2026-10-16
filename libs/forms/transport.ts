// Enhanced POSTs to a form action and the router's JSON answer (resume-format encoded).
// Loaded on demand (submit, remote field checks), never with the first input handler.
import { _decodeWire } from "@rivetjs/runtime/resume-format";
import type { ActionAnswer } from "@rivetjs/router";
import { invalidate, navigate } from "./router.ts";

/**
 * POST `data` to the form's action as the browser would (enctype respected), asking for JSON
 * (`revalidate`: plus the page's fresh loader data when the action succeeds).
 */
export async function post(element: HTMLFormElement, data: FormData, signal?: AbortSignal, revalidate = false): Promise<{ status: number; answer: ActionAnswer }> {
  const multipart = (element.getAttribute("enctype") ?? element.enctype) === "multipart/form-data";
  let body: FormData | URLSearchParams = data;
  if (!multipart) {
    const pairs = new URLSearchParams();
    for (const [name, value] of data) pairs.append(name, typeof value === "string" ? value : value.name);
    body = pairs;
  }
  const response = await fetch(element.action, {
    method: "POST",
    body,
    headers: { accept: "application/json", ...(revalidate ? { "x-rivet-revalidate": "1" } : {}) },
    credentials: "same-origin",
    ...(signal ? { signal } : {}),
  });
  const text = await response.text();
  let answer: ActionAnswer;
  try {
    answer = (await _decodeWire(text)) as ActionAnswer;
  } catch {
    answer = { error: { status: response.status, message: response.statusText || "Request failed" } };
  }
  return { status: response.status, answer };
}

/**
 * Follow a redirect the way a link would: a same-origin target goes through the app router
 * (`navigate()`), anything else (or a page without a client router) loads normally. A redirect to the
 * shown URL (post/redirect/get back to the form's page) revalidates it instead (`navigate()` to the
 * current URL is a no-op), from the answer's fresh data when the server sent it along (single flight).
 * Resolves once the shown page is fresh; another page: once it committed.
 */
export function follow(to: string, answer?: ActionAnswer): Promise<void> {
  const url = new URL(to, location.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || url.hash) return navigate(url);
  // Single flight (the server answered the page's fresh data with the redirect back to it): no data request.
  if (!answer?.data) return invalidate();
  return invalidate({ data: answer.data, ...(answer.head ? { head: answer.head } : {}), ...(answer.deps ? { deps: answer.deps } : {}) });
}
