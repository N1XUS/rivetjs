import { redirect, type PageProps, type RequestEvent, load, actions } from "@rivetjs/router";

const entries: string[] = ["Hello from the server"];

export const loader = load(() => ({ entries: [...entries] }));

export const forms = actions({
  sign: async ({ request }: RequestEvent<"index">) => {
    const message = String((await request.formData()).get("message") ?? "").trim();
    if (message) entries.push(message.slice(0, 140));
    return redirect("/", 303);
  },
});

export const head = { title: "Guestbook" };

export default function Guestbook({ data }: PageProps<"index">) {
  return (
    <main class="mx-auto max-w-xl p-6">
      <h1 class="text-2xl font-bold">Guestbook</h1>
      <ul id="entries" class="mt-4 list-disc pl-6">
        {data.entries.map((entry) => (
          <li>{entry}</li>
        ))}
      </ul>
      <form method="post" action="?/sign" class="mt-6 flex gap-2">
        <label for="message" class="sr-only">
          Message
        </label>
        <input id="message" name="message" maxLength={140} required class="flex-1 rounded-md border px-3 py-2" />
        <button id="sign" class="rounded-md bg-teal-700 px-4 py-2 text-white">
          Sign
        </button>
      </form>
    </main>
  );
}
