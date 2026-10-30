import { load, actions, fail, headers, type RequestEvent, type PageProps } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { login, loginRedirect } from "../server/http.server.ts";
import { sessionUser } from "../server/service.server.ts";
import { SiteNav } from "../sites/SiteNav.tsx";
export const loader = load(({ cookies }: RequestEvent) => ({ user: sessionUser(cookies.get("case-session")) }));
export const responseHeaders = headers(() => ({ "cache-control": "private, no-store", vary: "Cookie" }));
export const forms = actions({
  login: async (e: RequestEvent) => {
    const form = await e.request.formData();
    try {
      await login(e, String(form.get("email") ?? ""), String(form.get("password") ?? ""));
      return loginRedirect(String(form.get("next") ?? "/desk"));
    } catch {
      return fail(401, { error: "Wrong email or password" });
    }
  },
});
export const head = { title: "Sign in · Fieldwork" };
export default function SignIn({ data }: PageProps<typeof loader>) {
  const result = actionResult("login");
  return (
    <>
      <SiteNav />
      <main class="auth-shell">
        <section class="auth-card">
          <p class="eyebrow">YOUR WORKSPACE</p>
          <h1>Welcome back.</h1>
          <p>One account for your orders, support conversations, and team publishing.</p>
          {data.user ? <p id="current-user">Signed in as {data.user.email}</p> : null}
          <form method="post" action="?/login">
            <label>
              Email
              <input id="login-email" name="email" type="email" required autoComplete="username" />
            </label>
            <label>
              Password
              <input id="login-password" name="password" type="password" required autoComplete="current-password" />
            </label>
            <button id="login-submit">Sign in</button>
            {result?.status ? <p role="alert">Wrong email or password</p> : null}
          </form>
          <aside class="demo-accounts">
            <strong>Local demo accounts</strong>
            <p>
              alice@alpha.test · agent
              <br />
              bob@beta.test · another organization
              <br />
              viewer@alpha.test · read only
              <br />
              admin@alpha.test · administrator
            </p>
            <p>
              Password for these synthetic accounts: <code>demo-pass-2026</code>
            </p>
          </aside>
        </section>
      </main>
    </>
  );
}
