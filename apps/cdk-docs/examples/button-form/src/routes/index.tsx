import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";

export const head = { title: "Buttons in a form" };

// #region demo
export default function Post() {
  const result = signal("nothing yet");
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <form
        id="post"
        class="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget as HTMLFormElement, event.submitter);
          result.set(`intent=${data.get("intent")} title=${data.get("title")}`);
        }}
        onReset={() => result.set("reset")}
      >
        <label class="grid gap-1">
          Title
          <input id="title" name="title" required class="rounded border border-slate-300 px-2 py-1" />
        </label>
        <div class="flex flex-wrap gap-2">
          <Button id="publish" type="submit" name="intent" value="publish">
            Publish
          </Button>
          <Button id="draft" type="submit" name="intent" value="draft" formNoValidate>
            Save draft
          </Button>
          <Button id="clear" type="reset">
            Clear
          </Button>
        </div>
      </form>
      {/* Outside the <form>, linked by its id. */}
      <Button id="outside" type="submit" form="post" name="intent" value="outside">
        Submit from outside
      </Button>
      <output id="result" class="font-mono text-xs">
        {result()}
      </output>
    </section>
  );
}
// #endregion
