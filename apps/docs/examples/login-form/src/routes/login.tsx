import { fail, redirect, type PageProps, type RequestEvent } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { checkPassword, currentUser, startSession } from "../auth.server.ts";

export const head = { title: "Sign in" };

/** Only paths on this site ("/account"), never a full URL, "//evil.example" or "/\evil.example". */
const safeNext = (value: string | null) => (value && /^\/(?![/\\])/.test(value) ? value : "/");

// #region demo
// Server code in the page file: the compiler removes it (and the auth.server.ts import) from the browser build.
// Signed in already: no need to show the form.
export const serverLoad = ({ cookies, url }: RequestEvent) => {
  if (currentUser(cookies)) throw redirect(safeNext(url.searchParams.get("next")));
  return {};
};

export const serverActions = {
  /** Handles `<form method="post" action="?/login">`. */
  login: async ({ request, cookies }: RequestEvent) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const next = safeNext(String(form.get("next") ?? ""));
    const name = checkPassword(email, password);
    // Wrong email or password: render the form again with status 400. Send back the email, never the password.
    if (!name) return fail(400, { email, next, message: "Wrong email or password." });
    startSession(cookies, name);
    // Post/Redirect/Get: reloading the next page does not send the form again.
    return redirect(next, 303);
  },
};

/** A plain HTML form: it works before any JavaScript loads, and with JavaScript turned off. */
export default function Login({ url }: PageProps<typeof serverLoad>) {
  // Set when this page is the answer to a `?/login` post; `status` is set when the action returned `fail(...)`.
  const login = actionResult<typeof serverActions, "login">("login");
  const failed = login?.status !== undefined ? login.result : undefined;
  const next = failed?.next ?? url.searchParams.get("next") ?? "/";
  return (
    <main class="mx-auto max-w-sm p-6">
      <h1 class="text-2xl font-bold">Sign in</h1>
      {failed ? (
        <p id="error" role="alert" class="mt-4 rounded-md bg-red-50 p-3 text-red-800">
          {failed.message}
        </p>
      ) : null}
      <form method="post" action="?/login" class="mt-6 grid gap-4">
        <input type="hidden" name="next" value={next} />
        <label class="grid gap-1">
          Email
          <input
            name="email"
            type="email"
            value={failed?.email ?? ""}
            autoComplete="username"
            required
            class="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label class="grid gap-1">
          Password
          <input name="password" type="password" autoComplete="current-password" required class="rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <button class="rounded-md bg-teal-700 px-4 py-2 font-semibold text-white">Sign in</button>
      </form>
      <p class="mt-4 text-sm text-slate-600">Demo account: demo@example.com, password rivet-demo.</p>
    </main>
  );
}
// #endregion
