import { load, type PageProps } from "@rivetjs/router";
import { wait } from "../gate.server";
import { Async } from "@rivetjs/runtime/dom";
export const loader = load(
  async ({ url }) => {
    if (url.searchParams.has("gate")) await wait(url.searchParams.get("gate")!);
    else await new Promise((done) => setTimeout(done, 80));
    throw new Error("LATE_ERROR_CANARY_e20318bd");
  },
  { defer: true },
);
export default function LateError({ data }: PageProps<typeof loader>) {
  return (
    <main>
      <p id="shell">public shell</p>
      <Async load={() => data} fallback={() => <p id="late-wait">waiting</p>}>
        {() => <p>unreachable</p>}
      </Async>
    </main>
  );
}
