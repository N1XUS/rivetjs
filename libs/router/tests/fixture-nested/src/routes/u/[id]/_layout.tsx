import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";

export default function UserLayout({ data, params, children }: LayoutProps<{ id: string; loads: number }, { id: string }>) {
  const count = signal(0);
  return (
    <section id="user">
      <button type="button" id="u-count" onClick={() => count.update((n) => n + 1)}>
        U {count()}
      </button>
      <p id="u-data">{data().id + ":" + data().loads}</p>
      <p id="u-params">{params().id}</p>
      {children}
    </section>
  );
}
