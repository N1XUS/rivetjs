import { signal } from "@rivetjs/reactivity";
import type { PageProps } from "@rivetjs/router";
import type { loader } from "./sibling.server";
export default function Sibling({ data }: PageProps<typeof loader>) {
  const n = signal(0);
  return (
    <main>
      <h1 id="sibling">{data.value}</h1>
      <button onClick={() => n.update((v) => v + 1)}>{n()}</button>
    </main>
  );
}
