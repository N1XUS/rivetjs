import { signal } from "@rivetjs/reactivity";

/** A native POST still works without JavaScript; a signal adds the character count. */
export function NoteForm() {
  const draft = signal("");
  return (
    <form method="post" action="?/add" class="mt-6 flex flex-col gap-2">
      <label for="text" class="font-semibold">
        New note
      </label>
      <div class="flex flex-wrap gap-2">
        <input
          id="text"
          name="text"
          model:value={draft}
          maxLength={200}
          required
          aria-describedby="note-length"
          class="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2"
        />
        <button type="submit" class="rounded-md bg-teal-700 px-4 py-2 font-semibold text-white">
          Add
        </button>
      </div>
      <p id="note-length" class="text-sm">
        {draft().length} of 200 characters
      </p>
    </form>
  );
}
