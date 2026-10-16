// Resumable components capturing a store (R-4): only read paths get signals in the state. Function Bridge T12 / T13: the
// compiler marks the store with the literal paths of its references (`_rStorePaths`), so unread data (`blob`) stays on the
// server and the browser-only path `user.bio` ships.
import { at, createStore, read, write } from "@rivetjs/reactivity/store";

export function Todos() {
  const store = createStore({
    user: { name: "Ada", email: "ada@example.com", bio: "LONGBIO" },
    blob: "UNSHIPPED_BLOB",
    todos: [
      { title: "a", done: false },
      { title: "b", done: true },
    ],
  });
  const row = at(store, "todos.1");
  return (
    <div>
      <p id="name">{read(store, "user.name")}</p>
      <p id="done">{read(row, "done") ? "yes" : "no"}</p>
      <button id="rename" onClick={() => write(store, "user.name", (name) => name + "!")}>
        rename
      </button>
      <button id="toggle" onClick={() => write(row, "done", (done) => !done)}>
        toggle
      </button>
      <button id="email" onClick={() => write(store, "user.email", "x@example.com")}>
        email
      </button>
      <button id="bio" onClick={(event) => (event.currentTarget.textContent = String(read(store, "user.bio")))}>
        bio
      </button>
    </div>
  );
}
