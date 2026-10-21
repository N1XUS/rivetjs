import { load, redirect, type PageProps } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";

// A hole whose deferred loader redirects: the status is sent, so the browser navigates (client redirect).
export const loader = load(
  async ({ cookies }) => {
    if (!cookies.get("user")) throw redirect("/other");
    return { ok: true };
  },
  { defer: true },
);

export default function Moved({ data }: PageProps<typeof loader>) {
  return (
    <Async load={() => data} fallback={() => <p id="moved-wait">…</p>} error={() => <p id="moved-error">moved</p>}>
      {() => <p id="moved-ok">stayed</p>}
    </Async>
  );
}
