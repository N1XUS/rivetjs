import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";

export const head = { title: "Button" };

export default function ButtonStory() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  const pending = signal(false);
  const submits = signal(0);
  const pinned = signal(false);
  const changes = signal("");
  return (
    <section>
      <h1>Button</h1>
      <Button
        id="b-press"
        onPress={(e) => add("press:" + e.pointerType)}
        onPressStart={(e) => add("start:" + e.pointerType)}
        onPressEnd={(e) => add("end:" + e.pointerType)}
        onPressChange={(p) => add("change:" + p)}
        onClick={() => add("click")}
      >
        Press
      </Button>
      <Button id="b-disabled" isDisabled onPress={() => add("disabled")}>
        Disabled
      </Button>
      <Button id="b-aria" aria-label="Close" aria-expanded={false} aria-haspopup="dialog" aria-controls="b-log" excludeFromTabOrder>
        x
      </Button>
      <Button
        id="b-dom"
        lang="en"
        dir="ltr"
        onPress={() => add("dom-press")}
        onPointerEnter={() => add("enter")}
        onPointerLeave={() => add("leave")}
        onPointerDown={(e) => add("down:" + e.button)}
        onDblClick={() => add("dbl")}
        onContextMenu={(e) => {
          e.preventDefault();
          add("menu");
        }}
      >
        DOM
      </Button>
      <Button id="b-jsx" isPending={pending} onPointerEnter={() => add("jsx-enter")}>
        <b>Bold</b>
      </Button>
      <p id="b-log">{log().join(" ")}</p>
      <form
        id="b-form"
        onSubmit={(e) => {
          e.preventDefault();
          submits.update((n) => n + 1);
        }}
      >
        <input id="b-in1" name="a" />
        <input id="b-in2" name="b" />
        <Button id="b-submit" type="submit" isPending={pending} onPress={() => setTimeout(() => pending.set(true), 0)}>
          {({ isPending }) => (
            <>
              Save
              {/* RAC: a <ProgressBar> (ProgressBarContext id); until it lands, the `<id>-progress` element. */}
              <span id="b-submit-progress" hidden={!isPending()}>
                Saving
              </span>
            </>
          )}
        </Button>
      </form>
      <p id="b-submits">{submits()}</p>
      <ToggleButton id="tb-pin" isSelected={pinned} onChange={(v) => changes.update((c) => c + (v ? "1" : "0"))}>
        Pin
      </ToggleButton>
      <ToggleButton id="tb-disabled" isDisabled defaultSelected>
        Locked
      </ToggleButton>
      <p id="tb-value">
        {pinned() ? "on" : "off"} {changes()}
      </p>
    </section>
  );
}
