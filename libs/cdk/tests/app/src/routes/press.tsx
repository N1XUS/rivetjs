import { signal } from "@rivetjs/reactivity";
import { pressProps, type PressEvent } from "@rivetjs/cdk/interactions/press";
import { longPressProps } from "@rivetjs/cdk/interactions/long-press";
import { keyboardProps } from "@rivetjs/cdk/interactions/keyboard";

export const head = { title: "Press" };

export default function PressStory() {
  const log = signal<string[]>([]);
  const add = (e: PressEvent) => log.update((l) => [...l, `${e.type}:${e.pointerType}`]);
  const press = pressProps({
    onPressStart: (e: PressEvent) => add(e),
    onPressEnd: (e: PressEvent) => add(e),
    onPressUp: (e: PressEvent) => add(e),
    onPress: (e: PressEvent) => add(e),
  });
  const { pressProps: cancelProps } = pressProps({
    shouldCancelOnPointerExit: true,
    onPress: (e: PressEvent) => add(e),
    onPressEnd: (e: PressEvent) => add(e),
  });
  const long = signal("");
  const longPress = longPressProps({
    threshold: 300,
    onLongPress: (e) => long.set("long:" + e.pointerType),
    onLongPressEnd: () => long.update((v) => v + "+end"),
  });
  const keys = signal("");
  const keyboard = keyboardProps({ onKeyDown: (e) => keys.update((v) => v + e.key), shortcuts: { "Shift+a": () => void keys.update((v) => v + "[S-a]") } });
  return (
    <section>
      <div id="target" role="button" tabIndex={0} {...press.pressProps} data-pressed={press.isPressed() ? "true" : "false"}>
        Press me
      </div>
      <div id="cancel" role="button" tabIndex={0} {...cancelProps}>
        Cancel on exit
      </div>
      <button id="long" type="button" {...longPress.longPressProps}>
        Long
      </button>
      <input id="keys" aria-label="Keys" {...keyboard.keyboardProps} />
      <p id="log">{log().join(" ")}</p>
      <p id="long-log">{long()}</p>
      <p id="key-log">{keys()}</p>
    </section>
  );
}
