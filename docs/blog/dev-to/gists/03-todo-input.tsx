// todo.tsx — the input for the next three gists (server, DOM v2, resumable server).
import { signal } from "@rivetjs/reactivity";

export function TodoList(props: { items: { id: number; label: string }[] }) {
  const done = signal(0);
  return (
    <section class={done() > 0 ? "busy" : "idle"}>
      <p>Done: {done()}</p>
      <ul>
        {props.items.map((item) => (
          <li>{item.label}</li>
        ))}
      </ul>
      <button onClick={() => done.update((n) => n + 1)}>Mark one done</button>
    </section>
  );
}
