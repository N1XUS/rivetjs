import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";

export const head = { title: "Disabled and unfocusable Buttons" };

// #region demo
export default function Buttons() {
  const last = signal("none");
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <div class="flex flex-wrap gap-2">
        <Button id="first" onPress={() => last.set("first")}>
          First
        </Button>
        <Button id="off" isDisabled onPress={() => last.set("off")}>
          Disabled
        </Button>
        <Button id="skip" excludeFromTabOrder onPress={() => last.set("skip")}>
          Not in Tab order
        </Button>
        <Button id="last" onPress={() => last.set("last")}>
          Last
        </Button>
        <Button id="keep-focus" preventFocusOnPress onPress={() => last.set("keep-focus")}>
          Keeps focus where it was
        </Button>
      </div>
      <p id="log">Last press: {last()}</p>
    </section>
  );
}
// #endregion
