import type { PageProps } from "@rivetjs/router";
import { load } from "@rivetjs/router";
import { authOf } from "../server/sessions.server.ts";

export const head = { title: "Accounts" };

export const loader = load((event) => ({ name: authOf(event)?.user.name ?? null }));

export default function Home({ data }: PageProps<typeof loader>) {
  return (
    <main class="flex flex-col gap-4">
      <h1 class="text-2xl font-semibold">{data.name ? `Welcome back, ${data.name}` : "Accounts and sessions"}</h1>
      <p class="text-muted">
        Database sessions on node:sqlite: hashed tokens, sliding expiry, rotation on sign-in and password changes, a sessions list, password reset links and
        login rate limits. Every form works with JavaScript off.
      </p>
      <p>
        {data.name ? (
          <a href="/account" class="text-accent underline">
            Your account and sessions
          </a>
        ) : (
          <>
            <a href="/signup" class="text-accent underline">
              Create an account
            </a>{" "}
            or{" "}
            <a href="/signin" class="text-accent underline">
              sign in
            </a>
            .
          </>
        )}
      </p>
    </main>
  );
}
