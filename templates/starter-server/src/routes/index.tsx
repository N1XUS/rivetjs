import { redirect, type PageProps, type RequestEvent } from "@rivetjs/router";

// Server code in the page file: `serverLoad` and `serverActions` (and everything only they use, like
// `notes`) run on the server and are removed from the browser build. A real app would use a database.
const notes: string[] = ["Rendered on the server"];

/** Data for the page, loaded on the server for every request. */
export const serverLoad = () => ({ notes });

export const serverActions = {
  /** Handles `<form method="post" action="?/add">`. */
  add: async ({ request }: RequestEvent<"index">) => {
    const text = String((await request.formData()).get("text") ?? "").trim();
    if (text) notes.push(text.slice(0, 200));
    // Post/redirect/get: reloading the page does not submit the form again.
    return redirect("/", 303);
  },
};

export const head = { title: "Notes" };

/** A list from the loader and a form handled by an action. Works with JavaScript turned off. */
export default function Home({ data }: PageProps<"index">) {
  return (
    <main class="mx-auto max-w-xl p-6">
      <h1 class="text-2xl font-bold">Notes</h1>
      <ul class="mt-4 list-disc pl-6">
        {data.notes.map((note) => (
          <li>{note}</li>
        ))}
      </ul>
      <form method="post" action="?/add" class="mt-6 flex gap-2">
        <label class="sr-only" for="text">
          New note
        </label>
        <input id="text" name="text" class="flex-1 rounded-md border border-slate-300 px-3 py-2" required />
        <button class="rounded-md bg-teal-700 px-4 py-2 font-semibold text-white">Add</button>
      </form>
    </main>
  );
}
