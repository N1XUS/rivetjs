import { fail, redirect, type PageProps, type RequestEvent, load, actions } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";

// Kept in memory for the demo. A real app would use a database.
// Only the server exports use it, so it is removed from the browser build.
const messages: { name: string; text: string }[] = [];

export const loader = load(() => ({ messages }));

export const head = { title: "Guestbook" };

// #region demo
export const forms = actions({
  // Runs for <form method="post" action="?/sign">.
  sign: async ({ request }: RequestEvent) => {
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const text = String(form.get("text") ?? "").trim();
    // Answer 400 and render the page again; the page reads this object with actionResult().
    if (!name || !text) return fail(400, { error: "Please fill in both fields.", name, text });
    messages.push({ name: name.slice(0, 50), text: text.slice(0, 500) });
    // Post/Redirect/Get: reloading the page will not send the form again.
    return redirect("/");
  },
});

// A plain HTML form. It works before any JavaScript loads, and with JavaScript off.
export default function Guestbook({ data }: PageProps<typeof loader>) {
  // Set when this page renders as the answer to a "sign" post; `status` is set when it failed.
  const sign = actionResult<typeof forms, "sign">("sign");
  const failed = sign?.status !== undefined ? sign.result : undefined;
  return (
    <main class="mx-auto max-w-xl p-4">
      <h1 class="text-xl font-semibold">Guestbook</h1>
      {failed ? (
        <p role="alert" class="mt-2 text-red-700">
          {failed.error}
        </p>
      ) : null}
      <form method="post" action="?/sign" class="mt-4 grid gap-2">
        <label for="name">Name</label>
        {/* Put back what the visitor typed, so nothing is lost. */}
        <input id="name" name="name" class="rounded border px-2 py-1" value={failed?.name ?? ""} />
        <label for="text">Message</label>
        <textarea id="text" name="text" class="rounded border px-2 py-1">
          {failed?.text ?? ""}
        </textarea>
        <button class="justify-self-start rounded bg-teal-700 px-4 py-1 text-white">Sign</button>
      </form>
      <ul class="mt-6 grid gap-2">
        {data.messages.map((message) => (
          <li>
            <strong>{message.name}</strong>: {message.text}
          </li>
        ))}
      </ul>
    </main>
  );
}
// #endregion
