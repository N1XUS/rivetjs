import { load, type Deferred, type PageProps } from "@rivetjs/router";
import { resource, Suspense } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
import { gate } from "../gate.server.ts";

// A deferred loader read through `resource` inside `Suspense`.
export const loader = load(
  async () => {
    await gate("res");
    return { count: 3 };
  },
  { defer: true },
);

function Count(props: { data: Deferred<{ count: number }> }) {
  const counted = resource(() => props.data);
  const bumps = signal(0);
  return (
    <p>
      <span id="count">{counted()?.count}</span>{" "}
      <button id="bump" type="button" onClick={() => bumps.update((n) => n + 1)}>
        Bumps {bumps()}
      </button>
    </p>
  );
}

export default function Res({ data }: PageProps<typeof loader>) {
  return (
    <Suspense fallback={() => <p id="res-wait">Counting…</p>}>
      <Count data={data} />
    </Suspense>
  );
}
