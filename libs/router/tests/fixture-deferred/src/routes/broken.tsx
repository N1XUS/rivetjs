import { load, notFound, type PageProps } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";

// A deferred loader failing after the head is out: the boundary's error view, the status stays 200.
export const loader = load(
  async (): Promise<{ never: string }> => {
    throw notFound("gone");
  },
  { defer: true },
);

export default function Broken({ data }: PageProps<typeof loader>) {
  return (
    <Async load={() => data} fallback={() => <p>…</p>} error={(error) => <p id="failed">{String((error as { status?: number }).status)}</p>}>
      {(value) => <p>{value.never}</p>}
    </Async>
  );
}
