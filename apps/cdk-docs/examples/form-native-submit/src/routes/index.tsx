import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Form } from "@rivetjs/cdk/form";

export const head = { title: "Form is a native form" };

// #region demo
export default function Search() {
  const submits = signal(0);
  const last = signal("");
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <Form
        id="search-form"
        name="search"
        action="/search"
        method="get"
        aria-label="Site search"
        onSubmit={(event) => {
          // Called only when the form is valid. Prevent it here to handle the submit yourself.
          event.preventDefault();
          submits.update((n) => n + 1);
          last.set(String(new FormData(event.currentTarget as HTMLFormElement).get("q")));
        }}
      >
        <div class="flex gap-2">
          <input id="ns-q" name="q" required aria-label="Query" class="rounded border border-slate-300 px-2 py-1" />
          <Button id="ns-go" type="submit">
            Search
          </Button>
        </div>
      </Form>
      <output id="ns-log">
        submits: {submits()}
        {last() ? ` (q=${last()})` : ""}
      </output>
    </section>
  );
}
// #endregion
