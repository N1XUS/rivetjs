import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { ProgressBar } from "@rivetjs/cdk/progress-bar";

export const head = { title: "Button with plain CSS" };

// #region demo
export default function CssButtons() {
  const saving = signal(false);
  return (
    <div class="demo">
      <Button id="css-save" isPending={saving} onPress={() => saving.set(true)}>
        {({ isPending }) => <>Save{isPending() ? <ProgressBar class="spinner" aria-label="Saving" isIndeterminate /> : null}</>}
      </Button>
      {/* Keep rv-Button when you add a class of your own. */}
      <Button id="css-delete" class="rv-Button danger">
        Delete
      </Button>
      <Button isDisabled>Disabled</Button>
      <span id="css-status">{saving() ? "saving" : "idle"}</span>
    </div>
  );
}
// #endregion
