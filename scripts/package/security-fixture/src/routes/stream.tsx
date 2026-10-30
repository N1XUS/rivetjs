import { load, type PageProps } from "@rivetjs/router";
import { wait } from "../gate.server";
import { Async } from "@rivetjs/runtime/dom";
export const loader = load(
  async ({ url }) => {
    if (url.searchParams.has("gate")) await wait(url.searchParams.get("gate")!);
    else await new Promise((done) => setTimeout(done, 80));
    return { payload: url.searchParams.get("q") ?? "safe" };
  },
  { defer: true },
);
export default function Stream({ data }: PageProps<typeof loader>) {
  return (
    <main>
      <p id="shell">public shell</p>
      <Async load={() => data} fallback={() => <p>waiting</p>}>
        {(value) => <p id="stream">{value.payload}</p>}
      </Async>
    </main>
  );
}
