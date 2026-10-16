import { signal } from "@rivetjs/reactivity";

export const head = { title: "JSON endpoint" };

type Note = { id: number; text: string };

export default function Notes() {
  const notes = signal<Note[]>([]);
  const text = signal("");
  const error = signal("");
  const load = async () => notes.set((await (await fetch("/api/notes")).json()) as Note[]);
  const add = async (event: SubmitEvent) => {
    event.preventDefault();
    const response = await fetch("/api/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: text() }) });
    if (!response.ok) return error.set(((await response.json()) as { error: string }).error);
    error.set("");
    text.set("");
    await load();
  };
  return (
    <section class="grid max-w-sm gap-3 p-4 text-sm">
      <button id="load" type="button" class="justify-self-start rounded bg-slate-200 px-2 py-1" onClick={load}>
        Load notes
      </button>
      <ul id="notes" class="list-disc pl-5">
        {notes().map((note) => (
          <li>{note.text}</li>
        ))}
      </ul>
      <form class="flex gap-2" onSubmit={add}>
        <input id="text" class="rounded border border-slate-300 px-2 py-1" model:value={text} aria-label="New note" />
        <button type="submit" class="rounded bg-teal-700 px-2 py-1 text-white">
          Add
        </button>
      </form>
      <p id="error" role="alert" class="text-red-700">
        {error()}
      </p>
    </section>
  );
}
