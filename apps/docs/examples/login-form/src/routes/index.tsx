import { redirect, type PageProps, type RequestEvent, load, actions } from "@rivetjs/router";
import { currentUser, endSession } from "../auth.server.ts";

export const head = { title: "Home" };

export const loader = load(({ cookies }: RequestEvent) => ({ user: currentUser(cookies) }));

export const forms = actions({
  /** Handles `<form method="post" action="?/logout">`. */
  logout: ({ cookies }: RequestEvent) => {
    endSession(cookies);
    return redirect("/", 303);
  },
});

export default function Home({ data }: PageProps<typeof loader>) {
  return (
    <main class="mx-auto max-w-sm p-6">
      <h1 class="text-2xl font-bold">Home</h1>
      {data.user ? (
        <>
          <p id="user" class="mt-4">
            Signed in as {data.user}.
          </p>
          <form method="post" action="?/logout" class="mt-4">
            <button class="rounded-md border border-slate-300 px-4 py-2">Sign out</button>
          </form>
        </>
      ) : (
        <p class="mt-4">
          You are not signed in.{" "}
          <a class="text-teal-700 underline" href="/login">
            Sign in
          </a>
        </p>
      )}
    </main>
  );
}
