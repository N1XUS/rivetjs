import { signal } from "@rivetjs/reactivity";
import { Button, type PressEvent } from "@rivetjs/cdk/button";

export const head = { title: "Button events" };

// #region demo
export default function ButtonEvents() {
  const log = signal<string[]>([]);
  const count = signal(0);
  // Local constants and inline arrows resume in the browser.
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  const onPress = (event: PressEvent) => {
    count.update((n) => n + 1);
    add("press:" + event.pointerType);
  };
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      <Button
        id="save"
        onPress={onPress}
        onPressStart={(event) => add("start:" + event.pointerType)}
        onPressUp={(event) => add("up:" + event.pointerType)}
        onPressEnd={(event) => add("end:" + event.pointerType)}
        onPressChange={(isPressed) => add("change:" + isPressed)}
        onClick={() => add("click")}
        onFocus={() => add("focus")}
        onBlur={() => add("blur")}
        onKeyDown={(event) => add("keydown:" + event.key)}
        onKeyUp={(event) => add("keyup:" + event.key)}
      >
        Save
      </Button>
      <p id="count">
        Pressed {count()} {count() === 1 ? "time" : "times"}
      </p>
      <output id="log" class="block font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
