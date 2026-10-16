import { redirect, type PageProps, type RequestEvent } from "@rivetjs/router";
import { endSession } from "../../sessions.server.ts";

export const head = { title: "Account" };

// The layout guard already ran and set locals.user.
export const serverLoad = ({ locals }: RequestEvent) => ({ user: String(locals.user) });

export const serverActions = {
  logout: ({ cookies }: RequestEvent) => {
    endSession(cookies.get("session"));
    cookies.delete("session");
    return redirect("/", 303);
  },
};

// URL: /account (the (private) folder adds nothing to the URL).
export default function Account({ data }: PageProps<typeof serverLoad>) {
  return (
    <main class="p-4">
      <h1 class="text-xl font-semibold">Hello, {data.user}</h1>
      <form method="post" action="?/logout" class="mt-4">
        <button class="rounded bg-slate-700 px-4 py-1 text-white">Sign out</button>
      </form>
    </main>
  );
}
