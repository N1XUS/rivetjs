import { load, type PageProps } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";
export const loader = load(
  async () => {
    await new Promise((r) => setTimeout(r, 100));
    return { text: "deferred-payload" };
  },
  { defer: true },
);
export default function Stream({ data }: PageProps<typeof loader>) {
  return (
    <main>
      <h1>Stream shell</h1>
      <Async load={() => data} fallback={() => <p>Waiting</p>}>
        {(value) => <p id="stream-value">{value.text}</p>}
      </Async>
    </main>
  );
}
