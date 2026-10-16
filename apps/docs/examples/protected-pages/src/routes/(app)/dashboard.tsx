import { redirect, type PageProps, type RequestEvent } from "@rivetjs/router";
import { signOut } from "../../session.server.ts";

export const head = { title: "Dashboard" };

// The layout guard already ran and put the user in `locals`.
// (A page file cannot import types from a `.server.ts` module, so the type is written out here.)
export const serverLoad = ({ locals }: RequestEvent) => ({ name: (locals.user as { name: string }).name });

export const serverActions = {
  logout: ({ cookies }: RequestEvent) => {
    signOut(cookies);
    return redirect("/", 303);
  },
};

export default function Dashboard({ data }: PageProps<typeof serverLoad>) {
  return (
    <main class="mx-auto max-w-xl p-6">
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <p id="welcome" class="mt-4">
        Welcome back, {data.name}.
      </p>
      <p class="mt-4 flex gap-4">
        <a class="text-teal-700 underline" href="/settings">
          Settings
        </a>
        <a class="text-teal-700 underline" href="/">
          Home
        </a>
      </p>
      <form method="post" action="?/logout" class="mt-6">
        <button class="rounded-md border border-slate-300 px-4 py-2">Sign out</button>
      </form>
    </main>
  );
}
