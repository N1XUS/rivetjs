import { signal } from "@rivetjs/reactivity";
import type { PageProps } from "@rivetjs/router";
import { beforeLeave, invalidate, navigate } from "@rivetjs/router/client";

export default function Home({ data }: PageProps<{ loads: number }, {}>) {
  const posted = signal("");
  return (
    <section class="tall">
      <h1>Home</h1>
      <p id="loads">{data.loads}</p>
      <button type="button" id="go-item" onClick={() => navigate("/items/7?q=x", { state: { from: "home" } }).then(() => (document.documentElement.dataset.done = "item"))}>
        Item
      </button>
      <button
        type="button"
        id="guard-once"
        onClick={() => {
          const stop = beforeLeave((leave) => {
            stop();
            document.documentElement.dataset.left = leave.type + " " + leave.to?.pathname;
            leave.cancel();
          });
        }}
      >
        Guard
      </button>
      <button
        type="button"
        id="guard-history"
        onClick={() => {
          // Back/forward guard: records every leave; cancels history leaves unless data-allow is set.
          const root = document.documentElement;
          const stop = beforeLeave((leave) => {
            root.dataset.left = leave.type + " " + leave.from.pathname + " " + leave.to?.pathname;
            if (leave.type === "history" && root.dataset.allow === undefined) leave.cancel();
          });
          (window as unknown as { __unguard: () => void }).__unguard = stop;
        }}
      >
        Guard history
      </button>
      <button type="button" id="go-replace" onClick={() => navigate("/about", { replace: true })}>
        Replace
      </button>
      <button type="button" id="go-out" onClick={() => navigate("https://example.invalid/")}>
        Out
      </button>
      <button type="button" id="invalidate" onClick={() => invalidate().then(() => (document.documentElement.dataset.done = "fresh"))}>
        Invalidate
      </button>
      <form
        method="post"
        action="/counter?/inc"
        id="inc"
        onSubmit={(event: SubmitEvent) => {
          event.preventDefault();
          const form = event.currentTarget as HTMLFormElement;
          fetch(form.action, { method: "POST", body: new FormData(form), headers: { accept: "application/json" } }).then(() => posted.set("posted"));
        }}
      >
        <button type="submit" id="inc-submit">Increment</button>
      </form>
      <p id="posted">{posted()}</p>
      <a href="/nowhere" id="nowhere">
        Unmatched
      </a>
    </section>
  );
}
