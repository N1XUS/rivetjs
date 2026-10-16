import { redirect, type PageProps, type RequestEvent } from "@rivetjs/router";
import { createSession } from "../sessions.server.ts";

export const head = { title: "Sign in" };

// Only follow local paths, so a link cannot send people to another site after login.
const safeNext = (value: unknown) => (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/account");

export const serverLoad = ({ url }: RequestEvent) => ({ next: safeNext(url.searchParams.get("next")) });

// #region demo
export const serverActions = {
  login: async ({ request, cookies }: RequestEvent) => {
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    // The form sends `next` in a hidden field: posting to "?/login" replaces the query string.
    const next = safeNext(form.get("next"));
    // A real app checks a password here.
    if (!name) return redirect("/login?next=" + encodeURIComponent(next), 303);
    // HttpOnly, Secure and SameSite=Lax are the defaults.
    cookies.set("session", createSession(name.slice(0, 50)), { maxAge: 60 * 60 });
    return redirect(next, 303);
  },
};
// #endregion

export default function Login({ data }: PageProps<typeof serverLoad>) {
  return (
    <main class="p-4">
      <h1 class="text-xl font-semibold">Sign in</h1>
      <form method="post" action="?/login" class="mt-4 grid max-w-xs gap-2">
        <input type="hidden" name="next" value={data.next} />
        <label for="name">Your name</label>
        <input id="name" name="name" class="rounded border px-2 py-1" required />
        <button class="justify-self-start rounded bg-teal-700 px-4 py-1 text-white">Sign in</button>
      </form>
    </main>
  );
}
