import { signal } from "@rivetjs/reactivity";
import { Link } from "@rivetjs/router/link";

export const head = { title: "Home" };
export default function Home() {
  const count = signal(0);
  return (
    <section>
      <h1>Home</h1>
      <ul id="items">
        <li>
          <Link to="/items/1" transition="zoom">
            <span class="card" data-vt-name="item-1" />
            First item
          </Link>
        </li>
        <li>
          <Link to="/items/2">
            <span class="card" data-vt-name="item-2" />
            Second item
          </Link>
        </li>
      </ul>
      <button type="button" id="home-count" onClick={() => count.update((n) => n + 1)}>
        Home count {count()}
      </button>
    </section>
  );
}
