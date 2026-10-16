import { signal } from "@rivetjs/reactivity";
import { Badge } from "../components/Badge.tsx";

export const head = { title: "Cart" };

export default function Home() {
  const items = signal(0);
  return (
    <main class="p-6">
      <div id="cart">
        <Badge count={items()} label="items" />
      </div>
      <button id="add" type="button" onClick={() => items.update((n) => n + 1)}>
        Add
      </button>
      <button id="clear" type="button" onClick={() => items.set(0)}>
        Clear
      </button>
    </main>
  );
}
