import { redirect, type PageProps, type RequestEvent, actions } from "@rivetjs/router";
import { signIn } from "../session.server.ts";

export const head = { title: "Sign in" };

const safeNext = (value: unknown) => (typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : "/dashboard");

export const forms = actions({
  /** Demo only: signs in without a password. See the login form recipe for a real check. */
  login: async ({ request, cookies }: RequestEvent) => {
    const form = await request.formData();
    signIn(cookies, { name: "Demo user" });
    return redirect(safeNext(form.get("next")), 303);
  },
});

export default function Login({ url }: PageProps) {
  return (
    <main class="mx-auto max-w-xl p-6">
      <h1 class="text-2xl font-bold">Sign in</h1>
      <p class="mt-4">You need to sign in to see that page.</p>
      <form method="post" action="?/login" class="mt-4">
        <input type="hidden" name="next" value={url.searchParams.get("next") ?? "/dashboard"} />
        <button class="rounded-md bg-teal-700 px-4 py-2 font-semibold text-white">Sign in as the demo user</button>
      </form>
    </main>
  );
}
