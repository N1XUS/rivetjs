// In-memory store for the example; a real app calls its database here.
export type Note = { id: number; text: string };

const notes: Note[] = [{ id: 1, text: "Endpoints return a Response" }];

export const listNotes = (): Note[] => notes;
export const findNote = (id: number): Note | undefined => notes.find((note) => note.id === id);
export function addNote(text: string): Note {
  const note = { id: notes.length + 1, text };
  notes.push(note);
  return note;
}
