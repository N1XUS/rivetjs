import type { PageProps } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { createForm, defaultValue, formId, onSubmit } from "@rivetjs/forms";
import { action } from "@rivetjs/forms/server";
import { noteForm } from "../forms/definitions.js";
import { load, actions } from "@rivetjs/router";

export const head = { title: "Notes" };

// In-memory notes (per server process): the action adds one; the page lists them.
const notes: string[] = [];
export const loader = load(() => ({ notes: [...notes] }));
export const forms = actions({
  add: action(noteForm, (value) => {
    notes.push(value.note);
  }),
});

/** Same-URL action: a successful enhanced submit revalidates the page (the list shows the new note). */
export default function NotesPage({ data }: PageProps<typeof loader>) {
  const form = createForm(noteForm, { result: actionResult() });
  return (
    <section>
      <h1>Notes</h1>
      <ul id="notes">
        {data.notes.map((note) => (
          <li>{note}</li>
        ))}
      </ul>
      <form id={formId(form)} method="post" action="?/add" class="stack" onSubmit={(event) => onSubmit(noteForm, form, event)}>
        <input id="note-text" name="note" aria-label="Note" class="input" required value={defaultValue(form, "note")} />
        <button id="note-add" type="submit" class="button">
          Add note
        </button>
      </form>
    </section>
  );
}
